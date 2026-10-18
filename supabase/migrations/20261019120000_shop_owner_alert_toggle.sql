-- Shop owner can turn off the WhatsApp new-order alert (default on). The
-- dashboard bell/badge covers owners who turn it off.
alter table public.shop_config add column if not exists notify_owner_whatsapp boolean not null default true;
