-- New-order WhatsApp alerts are now per branch: each branch has its own phone
-- and its own on/off switch (default on).
alter table public.shop_branches add column if not exists notify_owner_whatsapp boolean not null default true;

-- Keep what merchants already chose: a shop that had the shop-wide alert
-- switched off starts with every branch off.
update public.shop_branches b set notify_owner_whatsapp = false
  from public.shop_config c
 where c.project_id = b.project_id and c.notify_owner_whatsapp = false;

-- The Settings phone number is going away. Give every branch that has no
-- phone the number it was using until now, so alerts keep arriving.
update public.shop_branches b set phone = regexp_replace(c.store_phone, '\D', '', 'g')
  from public.shop_config c
 where c.project_id = b.project_id
   and b.phone is null
   and regexp_replace(coalesce(c.store_phone, ''), '\D', '', 'g') ~ '^[0-9]{8,15}$';
