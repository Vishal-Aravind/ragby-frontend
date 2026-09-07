-- ============================================================
-- Widget domain allowlist
-- ============================================================
-- The embeddable widget's only credential is the projectId, which is
-- visible in the page source of every site it runs on. Anyone could lift it
-- and run the merchant's bot from their own site or from curl, indefinitely,
-- against the merchant's quota and our OpenAI key.
--
-- NULL / empty array means "allow anywhere", so existing embeds keep working
-- untouched; a merchant opts in by listing their domains.
--
-- Worth being honest about the strength of this control: it checks the
-- browser-supplied Origin header, which a non-browser client can set to
-- anything. It reliably stops someone copying the snippet onto a real
-- website (the browser sends the true Origin and cannot be told otherwise),
-- and it does not stop a determined scripted caller. The rate limits and
-- monthly quota remain the backstop for that.
--
-- Safe to re-run.
-- ============================================================

alter table projects
  add column if not exists allowed_domains text[];
