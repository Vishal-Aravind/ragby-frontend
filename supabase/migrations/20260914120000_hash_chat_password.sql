-- ============================================================
-- Hash the public chat password at rest
-- ============================================================
-- projects.chat_password stored the merchant's widget password in
-- plaintext. backend/chat.py's verify_chat_password compared it with
-- hmac.compare_digest against the raw column, _project_public_settings
-- pulled it into memory on EVERY public chat request just to read its
-- truthiness, and the project GET route served it back to the settings UI.
--
-- Replaced by a scrypt hash (see src/lib/chat-password.js and the matching
-- _verify_chat_password in backend/chat.py). scrypt rather than the bare
-- SHA-256 used for api_keys, because a chat password is human-chosen and
-- therefore low-entropy — it needs a slow, salted KDF, not a fast digest.
--
-- NO BACKFILL. A plaintext password cannot be converted into a scrypt hash
-- without the original, and there is nothing to convert: the audit
-- confirmed zero projects have chat_password set. The pre-check below
-- proves that again at run time and aborts if it ever stops being true,
-- rather than silently unlocking a protected chat.
--
-- Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Refuse to run if any project would lose a live password
-- ------------------------------------------------------------
do $$
declare
  v_count int;
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'projects' and column_name = 'chat_password'
  ) then
    execute 'select count(*) from projects where chat_password is not null'
      into v_count;
    if v_count > 0 then
      raise exception
        'Aborting: % project(s) still have a plaintext chat_password. Clear them in the dashboard first, then re-run — they cannot be converted to a hash automatically.', v_count;
    end if;
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. The hash column
-- ------------------------------------------------------------
alter table projects add column if not exists chat_password_hash text;

comment on column projects.chat_password_hash is
  'scrypt$N$r$p$salt_b64$hash_b64. Written by src/lib/chat-password.js, verified by backend/chat.py. Never returned to any client.';

-- ------------------------------------------------------------
-- 3. Drop the plaintext column
-- ------------------------------------------------------------
-- Leaving it would just move the plaintext one column sideways.
alter table projects drop column if exists chat_password;
