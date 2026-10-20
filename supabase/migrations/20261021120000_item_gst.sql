-- GST can now be set per menu item. An item with NO rate (NULL) uses the shop
-- rate from Settings; 0 means the item is GST-exempt.
--
-- Until now every product was saved with 0 by default and the checkout
-- ignored it (only the shop-wide rate was used). So every existing 0 means
-- "never set" - turn them into NULL so existing shops keep charging the shop
-- rate exactly as before.
alter table public.products alter column gst_percent drop not null;
alter table public.products alter column gst_percent drop default;
update public.products set gst_percent = null where gst_percent = 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_gst_percent_range') then
    alter table public.products add constraint products_gst_percent_range
      check (gst_percent is null or (gst_percent >= 0 and gst_percent <= 100));
  end if;
end $$;

-- What was charged, by rate, on each order (for the invoice / receipt):
-- [{"rate": 5, "taxable": 200.00, "tax": 10.00}, {"rate": 18, ...}]
alter table public.orders add column if not exists gst_breakdown jsonb not null default '[]'::jsonb;
