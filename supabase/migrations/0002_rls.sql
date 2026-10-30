-- NAMMA KADAI — 0002 Row Level Security
-- Every table is locked to the caller's shop. The money tables have NO insert/update
-- policy: they can only be written through the SECURITY DEFINER functions in 0003.

create function public.current_shop_id() returns uuid
language sql stable security definer set search_path = public as $$
  select shop_id from public.profiles where id = auth.uid()
$$;

alter table public.shops              enable row level security;
alter table public.profiles           enable row level security;
alter table public.customers          enable row level security;
alter table public.products           enable row level security;
alter table public.transactions       enable row level security;
alter table public.transaction_items  enable row level security;
alter table public.cash_sales         enable row level security;
alter table public.app_settings       enable row level security;
alter table public.audit_log          enable row level security;

-- start from nothing, then grant the minimum
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.shops, public.profiles, public.transactions, public.transaction_items,
                public.cash_sales, public.audit_log, public.customer_balances, public.v_transactions
  to authenticated;
grant select, insert, update on public.customers, public.products to authenticated;
grant select, insert, update on public.app_settings to authenticated;
grant update (name) on public.shops to authenticated;

create policy shops_select on public.shops for select to authenticated
  using (id = public.current_shop_id());
create policy shops_update on public.shops for update to authenticated
  using (id = public.current_shop_id()) with check (id = public.current_shop_id());

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid());

create policy customers_select on public.customers for select to authenticated
  using (shop_id = public.current_shop_id());
create policy customers_insert on public.customers for insert to authenticated
  with check (shop_id = public.current_shop_id());
create policy customers_update on public.customers for update to authenticated
  using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id());

create policy products_select on public.products for select to authenticated
  using (shop_id = public.current_shop_id());
create policy products_insert on public.products for insert to authenticated
  with check (shop_id = public.current_shop_id());
create policy products_update on public.products for update to authenticated
  using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id());

create policy settings_select on public.app_settings for select to authenticated
  using (shop_id = public.current_shop_id());
create policy settings_insert on public.app_settings for insert to authenticated
  with check (shop_id = public.current_shop_id());
create policy settings_update on public.app_settings for update to authenticated
  using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id());

create policy transactions_select on public.transactions for select to authenticated
  using (shop_id = public.current_shop_id());
create policy items_select on public.transaction_items for select to authenticated
  using (shop_id = public.current_shop_id());
create policy cash_sales_select on public.cash_sales for select to authenticated
  using (shop_id = public.current_shop_id());
create policy audit_select on public.audit_log for select to authenticated
  using (shop_id = public.current_shop_id());
