-- ============================================================
-- Shop: a one-store shop uses its own name, never "Main"
-- ============================================================
-- shop_default_branch_id: the auto-created default branch is named after
-- shop_config.store_name (falls back to 'Main' only when that is empty).
-- Existing one-branch shops whose branch is still the placeholder "Main"
-- are renamed to their store name, so customers stop seeing "Main".
--
-- Safe to re-run.
-- ============================================================
create or replace function public.shop_default_branch_id(p_project_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_tz    text;
  v_phone text;
  v_name  text;
begin
  if p_project_id is null then
    return null;
  end if;

  select id into v_id from shop_branches
   where project_id = p_project_id and is_default limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select timezone into v_tz from appointment_settings
   where project_id = p_project_id limit 1;
  select regexp_replace(coalesce(store_phone, ''), '\D', '', 'g'),
         left(nullif(btrim(store_name), ''), 80)
    into v_phone, v_name
    from shop_config where project_id = p_project_id limit 1;
  if v_phone is null or v_phone !~ '^[0-9]{8,15}$' then
    v_phone := null;
  end if;

  insert into shop_branches (project_id, name, phone, timezone, is_default, sort_order)
  values (p_project_id, coalesce(v_name, 'Main'), v_phone, coalesce(nullif(v_tz, ''), 'Asia/Kolkata'), true, 0)
  on conflict (project_id) where is_default do nothing;

  select id into v_id from shop_branches
   where project_id = p_project_id and is_default limit 1;
  return v_id;
end $$;

revoke all on function public.shop_default_branch_id(uuid) from public, anon, authenticated;
grant execute on function public.shop_default_branch_id(uuid) to service_role;

update shop_branches b
   set name = left(btrim(c.store_name), 80), updated_at = now()
  from shop_config c
 where c.project_id = b.project_id
   and b.name = 'Main'
   and nullif(btrim(c.store_name), '') is not null
   and (select count(*) from shop_branches x where x.project_id = b.project_id) = 1;
