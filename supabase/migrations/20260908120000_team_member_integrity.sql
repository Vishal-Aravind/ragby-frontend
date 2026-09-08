-- ============================================================
-- Team members: one row per user, and an atomic seat check
-- ============================================================
-- 1. project_members has `unique (project_id, email)` from
--    20260708120000, but nothing on (project_id, user_id). Signup stores
--    profiles.email verbatim and it can change, so inviting someone's new
--    address creates a SECOND row for the same person — and both
--    src/lib/supabase-api.js's getProjectAccess and backend/auth.py's
--    get_project_access resolve membership with maybeSingle/maybe_single,
--    which RAISE on two rows. That user then fails every permission check
--    in every tab, not just Team. Same defect class as the duplicate leads
--    contacts fixed in 20260907140000.
--
-- 2. The seat limit was a check-then-insert: count active members, then
--    insert, with nothing in between. Two invites fired at the last free
--    seat both passed. add_project_member locks the project row first, so
--    the second waits and then correctly fails.
--
-- Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Dedupe, keeping the oldest row per (project_id, user_id)
-- ------------------------------------------------------------
-- The oldest row owns the real created_at and the invite the team actually
-- made. An active duplicate beats a pending one, since losing access is
-- worse than keeping a stale pending row.
delete from project_members m
using (
  select id, row_number() over (
    partition by project_id, user_id
    order by (status = 'active') desc, created_at asc, id asc
  ) as rn
  from project_members
  where user_id is not null
) d
where m.id = d.id and d.rn > 1;

-- ------------------------------------------------------------
-- 2. The constraint
-- ------------------------------------------------------------
-- Partial: user_id is nullable in the current schema (a row can exist
-- before the invitee has an account), and those must not all collide.
create unique index if not exists project_members_project_user_uniq
  on project_members (project_id, user_id)
  where user_id is not null;

-- Supports the invite lookup's case-insensitive match on profiles.email.
-- The route matches with ILIKE on an escape-sanitised value; without this
-- that is a sequential scan of profiles on every invite.
create index if not exists profiles_email_lower_idx
  on profiles (lower(email));

-- ------------------------------------------------------------
-- 3. Atomic invite
-- ------------------------------------------------------------
-- Called with the service-role key from src/app/api/team/route.js, which
-- has already done authentication and authorization. security invoker (the
-- default) keeps it from becoming a privilege-escalation primitive if it is
-- ever reached any other way.
create or replace function add_project_member(
  p_project_id uuid,
  p_user_id    uuid,
  p_email      text,
  p_role       text,
  p_invited_by uuid,
  p_seat_limit int
)
returns project_members
language plpgsql
as $$
declare
  v_owner  uuid;
  v_active int;
  v_row    project_members;
begin
  -- Lock the project row. Anything else inviting into this project queues
  -- behind us, which is what makes the seat count below trustworthy.
  select user_id into v_owner
  from projects where id = p_project_id
  for update;

  if v_owner is null then
    raise exception 'project_not_found';
  end if;

  -- Checked inside the lock rather than by the caller, so a duplicate can't
  -- slip between the check and the insert.
  if exists (
    select 1 from project_members
    where project_id = p_project_id
      and (user_id = p_user_id or lower(email) = lower(p_email))
  ) then
    raise exception 'already_a_member';
  end if;

  select count(*) into v_active
  from project_members
  where project_id = p_project_id and status = 'active';

  -- +1 for the owner, who occupies a seat but has no project_members row.
  -- Reproduces the route's original arithmetic exactly: seats_used is the
  -- count BEFORE this insert, and the insert is refused once it has already
  -- reached the limit. So Free (1) allows the owner alone, and Pro (5)
  -- allows the owner plus four teammates.
  if p_seat_limit is not null and (1 + v_active) >= p_seat_limit then
    raise exception 'seat_limit_reached';
  end if;

  insert into project_members (project_id, user_id, email, role, status, invited_by)
  values (p_project_id, p_user_id, lower(p_email), p_role, 'active', p_invited_by)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function add_project_member(uuid, uuid, text, text, uuid, int) from public, anon;
grant execute on function add_project_member(uuid, uuid, text, text, uuid, int) to service_role;
