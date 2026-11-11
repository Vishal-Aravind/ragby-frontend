-- ============================================================
-- Shop: remove branches for good
-- ============================================================
-- Run ONLY after 20261111120000_shop_single_store.sql has run and the
-- single-store shop has been tested (settings, ordering, delivery,
-- payment, offers, invoices, the WhatsApp flow). This deletes the branch
-- data and cannot be undone.
--
-- Removes: shop_branches, the pincode geocode cache, the triggers that
-- filled in branch_id, the branch helper functions, and the branch_id /
-- branch_ids columns on catalogs, orders and offers. Old invoices keep the
-- branch name frozen in their seller_snapshot.
--
-- Safe to re-run.
-- ============================================================
drop trigger if exists catalogs_fill_branch_id on public.catalogs;
drop trigger if exists orders_fill_branch_id on public.orders;

-- Every overload of the branch helper functions, whatever their arguments.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('shop_fill_branch_id', 'copy_shop_menu', 'shop_default_branch_id')
  loop
    execute format('drop function if exists %s', f.sig);
  end loop;
end $$;

alter table public.catalogs drop constraint if exists catalogs_branch_fk;
alter table public.catalogs drop column if exists branch_id;

alter table public.orders drop constraint if exists orders_branch_fk;
alter table public.orders drop column if exists branch_id;

alter table public.offers drop constraint if exists offers_branch_ids_max;
alter table public.offers drop column if exists branch_ids;

drop table if exists public.shop_branches;
drop table if exists public.geocode_cache;
