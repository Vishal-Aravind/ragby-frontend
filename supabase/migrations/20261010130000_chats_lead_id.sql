-- A website chat remembers which contact it belongs to.
--
-- Website chats found their contact only through the browser id
-- (chats.visitor_id = leads.session_id). When the same person fills the
-- lead form again from another browser, the contact moves to the new
-- browser's id, and their older chats lost their name and details in
-- Conversations. chats.lead_id is set when a lead is captured, and on the
-- old browser's chats at the moment the contact moves.
alter table public.chats
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

create index if not exists chats_lead_id_idx on public.chats (lead_id);

-- Backfill: chats whose browser id still matches a contact.
update public.chats c
set lead_id = l.id
from public.leads l
where c.lead_id is null
  and c.visitor_id is not null
  and l.project_id = c.project_id
  and l.session_id = c.visitor_id;
