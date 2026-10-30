-- NAMMA KADAI — 0003 ledger functions
-- Every money write goes through these. Each one: authorises the caller, locks the
-- customer row (so concurrent writes are serialised), is idempotent on client_txn_id,
-- validates amounts in the database, and writes an audit entry — all in one transaction.
-- Errors are raised as 'CODE' strings that the app maps to friendly messages.

create function public.audit(p_action text, p_entity text, p_entity_id uuid, p_details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (shop_id, user_id, action, entity, entity_id, details)
  values (public.current_shop_id(), auth.uid(), p_action, p_entity, p_entity_id, p_details)
$$;
revoke execute on function public.audit(text, text, uuid, jsonb) from public, anon, authenticated;

-- audit for plain table edits (customers, products, settings)
create function public.audit_row() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (shop_id, user_id, action, entity, entity_id, details)
  values (coalesce(new.shop_id, old.shop_id), auth.uid(), tg_op, tg_table_name,
          nullif(to_jsonb(new)->>'id', '')::uuid,
          jsonb_build_object('new', to_jsonb(new), 'old', case when tg_op = 'UPDATE' then to_jsonb(old) end));
  return new;
end $$;
create trigger customers_audit after insert or update on public.customers
  for each row execute function public.audit_row();
create trigger products_audit after insert or update on public.products
  for each row execute function public.audit_row();
create trigger settings_audit after insert or update on public.app_settings
  for each row execute function public.audit_row();

create function public.require_shop() returns uuid language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  v := public.current_shop_id();
  if v is null then raise exception 'NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  return v;
end $$;

create function public.check_amount(p_amount numeric) returns void language plpgsql immutable as $$
begin
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;
  if p_amount <> round(p_amount, 2) then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;
  if p_amount > 10000000 then raise exception 'AMOUNT_TOO_LARGE' using errcode = 'P0001'; end if;
end $$;

create function public.check_time(p_at timestamptz) returns timestamptz language plpgsql stable as $$
begin
  if p_at is null then return now(); end if;
  if p_at > now() + interval '10 minutes' then raise exception 'INVALID_DATE' using errcode = 'P0001'; end if;
  if p_at < now() - interval '400 days' then raise exception 'INVALID_DATE' using errcode = 'P0001'; end if;
  return p_at;
end $$;

-- lock + fetch the caller's customer
create function public.lock_customer(p_shop uuid, p_customer uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.customers where id = p_customer and shop_id = p_shop for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0001'; end if;
end $$;
revoke execute on function public.lock_customer(uuid, uuid) from public, anon, authenticated;

create function public.outstanding_of(p_customer uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select outstanding from public.customer_balances where customer_id = p_customer
$$;
revoke execute on function public.outstanding_of(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
create function public.create_purchase(
  p_customer_id   uuid,
  p_amount        numeric,
  p_description   text,
  p_items         jsonb,
  p_client_txn_id uuid,
  p_occurred_at   timestamptz default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid := public.require_shop();
  v_id uuid; v_dup boolean := false; v_item jsonb; v_sum numeric := 0;
begin
  if p_client_txn_id is null then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  perform public.check_amount(p_amount);
  perform public.lock_customer(v_shop, p_customer_id);

  select id into v_id from public.transactions where shop_id = v_shop and client_txn_id = p_client_txn_id;
  if found then
    v_dup := true;
  else
    if p_items is not null and jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) > 0 then
      select coalesce(sum(round((i->>'quantity')::numeric * (i->>'unit_price')::numeric, 2)), 0)
        into v_sum from jsonb_array_elements(p_items) i;
      if v_sum <> p_amount then raise exception 'ITEMS_TOTAL_MISMATCH' using errcode = 'P0001'; end if;
    end if;
    insert into public.transactions (shop_id, customer_id, type, amount, description, client_txn_id, occurred_at)
    values (v_shop, p_customer_id, 'PURCHASE', p_amount, nullif(btrim(p_description), ''), p_client_txn_id, public.check_time(p_occurred_at))
    returning id into v_id;
    if v_sum > 0 then
      for v_item in select * from jsonb_array_elements(p_items) loop
        insert into public.transaction_items (shop_id, transaction_id, name, quantity, unit_price)
        values (v_shop, v_id, btrim(v_item->>'name'), (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric);
      end loop;
    end if;
    perform public.audit('PURCHASE', 'transactions', v_id, jsonb_build_object('customer_id', p_customer_id, 'amount', p_amount));
  end if;
  return jsonb_build_object('id', v_id, 'duplicate', v_dup, 'outstanding', public.outstanding_of(p_customer_id));
end $$;

create function public.create_payment(
  p_customer_id   uuid,
  p_amount        numeric,
  p_method        public.pay_method,
  p_note          text,
  p_client_txn_id uuid,
  p_occurred_at   timestamptz default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid := public.require_shop();
  v_id uuid; v_dup boolean := false; v_out numeric; v_adv boolean;
begin
  if p_client_txn_id is null or p_method is null then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  perform public.check_amount(p_amount);
  perform public.lock_customer(v_shop, p_customer_id);

  select id into v_id from public.transactions where shop_id = v_shop and client_txn_id = p_client_txn_id;
  if found then
    v_dup := true;
  else
    v_out := public.outstanding_of(p_customer_id);
    select allow_advance into v_adv from public.app_settings where shop_id = v_shop;
    if p_amount > greatest(v_out, 0) and not coalesce(v_adv, false) then
      raise exception 'PAYMENT_EXCEEDS_OUTSTANDING' using errcode = 'P0001';
    end if;
    insert into public.transactions (shop_id, customer_id, type, amount, description, payment_method, client_txn_id, occurred_at)
    values (v_shop, p_customer_id, 'PAYMENT', p_amount, nullif(btrim(p_note), ''), p_method, p_client_txn_id, public.check_time(p_occurred_at))
    returning id into v_id;
    perform public.audit('PAYMENT', 'transactions', v_id, jsonb_build_object('customer_id', p_customer_id, 'amount', p_amount, 'method', p_method));
  end if;
  return jsonb_build_object('id', v_id, 'duplicate', v_dup, 'outstanding', public.outstanding_of(p_customer_id));
end $$;

-- Manual correction. p_amount is signed: + increases what the customer owes, - decreases it.
create function public.create_adjustment(
  p_customer_id   uuid,
  p_amount        numeric,
  p_reason        text,
  p_client_txn_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid := public.require_shop();
  v_id uuid; v_dup boolean := false;
begin
  if p_client_txn_id is null or p_amount is null or p_amount = 0 then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;
  perform public.check_amount(abs(p_amount));
  if p_reason is null or char_length(btrim(p_reason)) < 3 then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
  perform public.lock_customer(v_shop, p_customer_id);
  select id into v_id from public.transactions where shop_id = v_shop and client_txn_id = p_client_txn_id;
  if found then
    v_dup := true;
  else
    insert into public.transactions (shop_id, customer_id, type, amount, description, client_txn_id)
    values (v_shop, p_customer_id, 'ADJUSTMENT', p_amount, btrim(p_reason), p_client_txn_id)
    returning id into v_id;
    perform public.audit('ADJUSTMENT', 'transactions', v_id, jsonb_build_object('customer_id', p_customer_id, 'amount', p_amount, 'reason', p_reason));
  end if;
  return jsonb_build_object('id', v_id, 'duplicate', v_dup, 'outstanding', public.outstanding_of(p_customer_id));
end $$;

-- Undo a purchase/payment/adjustment by adding an opposite adjustment. The original stays.
create function public.reverse_transaction(
  p_transaction_id uuid,
  p_reason         text,
  p_client_txn_id  uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid := public.require_shop();
  v_t public.transactions; v_id uuid; v_dup boolean := false; v_amt numeric;
begin
  if p_client_txn_id is null then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
  select * into v_t from public.transactions where id = p_transaction_id and shop_id = v_shop;
  if not found then raise exception 'TRANSACTION_NOT_FOUND' using errcode = 'P0001'; end if;
  perform public.lock_customer(v_shop, v_t.customer_id);
  select id into v_id from public.transactions where shop_id = v_shop and client_txn_id = p_client_txn_id;
  if found then
    v_dup := true;
  else
    if v_t.reverses_transaction_id is not null then raise exception 'CANNOT_REVERSE_REVERSAL' using errcode = 'P0001'; end if;
    if exists (select 1 from public.transactions where reverses_transaction_id = v_t.id) then
      raise exception 'ALREADY_REVERSED' using errcode = 'P0001';
    end if;
    v_amt := case v_t.type when 'PURCHASE' then -v_t.amount when 'PAYMENT' then v_t.amount else -v_t.amount end;
    insert into public.transactions (shop_id, customer_id, type, amount, description, client_txn_id, reverses_transaction_id)
    values (v_shop, v_t.customer_id, 'ADJUSTMENT', v_amt, 'Reversal: ' || btrim(p_reason), p_client_txn_id, v_t.id)
    returning id into v_id;
    perform public.audit('REVERSAL', 'transactions', v_id, jsonb_build_object('reverses', v_t.id, 'reason', p_reason));
  end if;
  return jsonb_build_object('id', v_id, 'duplicate', v_dup, 'outstanding', public.outstanding_of(v_t.customer_id));
end $$;

create function public.create_cash_sale(
  p_amount        numeric,
  p_note          text,
  p_client_txn_id uuid,
  p_occurred_at   timestamptz default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid := public.require_shop();
  v_id uuid; v_dup boolean := false;
begin
  if p_client_txn_id is null then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  perform public.check_amount(p_amount);
  perform pg_advisory_xact_lock(hashtext('cash:' || v_shop::text));
  select id into v_id from public.cash_sales where shop_id = v_shop and client_txn_id = p_client_txn_id;
  if found then
    v_dup := true;
  else
    insert into public.cash_sales (shop_id, amount, note, client_txn_id, occurred_at)
    values (v_shop, p_amount, nullif(btrim(p_note), ''), p_client_txn_id, public.check_time(p_occurred_at))
    returning id into v_id;
    perform public.audit('CASH_SALE', 'cash_sales', v_id, jsonb_build_object('amount', p_amount));
  end if;
  return jsonb_build_object('id', v_id, 'duplicate', v_dup);
end $$;

create function public.void_cash_sale(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_shop uuid := public.require_shop();
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
  update public.cash_sales set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
   where id = p_id and shop_id = v_shop and voided_at is null;
  if not found then raise exception 'TRANSACTION_NOT_FOUND' using errcode = 'P0001'; end if;
  perform public.audit('VOID_CASH_SALE', 'cash_sales', p_id, jsonb_build_object('reason', p_reason));
end $$;

-- ---------------------------------------------------------------------------
-- First-run setup: creates the shop + owner profile + settings. Only works while
-- no shop exists, so strangers who sign up later cannot create their own shop.
create function public.bootstrap_shop(p_shop_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_shop uuid;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHORIZED' using errcode = 'P0001'; end if;
  select shop_id into v_shop from public.profiles where id = auth.uid();
  if found then return v_shop; end if;
  if exists (select 1 from public.shops) then raise exception 'SETUP_CLOSED' using errcode = 'P0001'; end if;
  if p_shop_name is null or char_length(btrim(p_shop_name)) = 0 then raise exception 'INVALID_REQUEST' using errcode = 'P0001'; end if;
  insert into public.shops (name) values (btrim(p_shop_name)) returning id into v_shop;
  insert into public.profiles (id, shop_id, role) values (auth.uid(), v_shop, 'OWNER');
  insert into public.app_settings (shop_id) values (v_shop);
  insert into public.audit_log (shop_id, user_id, action, entity, entity_id, details)
  values (v_shop, auth.uid(), 'BOOTSTRAP', 'shops', v_shop, jsonb_build_object('name', p_shop_name));
  return v_shop;
end $$;

-- ---------------------------------------------------------------------------
-- Dashboard: everything is computed here from real rows. Days are Asia/Kolkata days.
create function public.dashboard_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_shop uuid := public.require_shop();
  v_start timestamptz := (date_trunc('day', now() at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata';
  v_credit numeric; v_pay numeric; v_cash numeric; v_cnt int; v_out numeric; v_cust int;
  v_pending jsonb; v_week jsonb; v_recent jsonb;
begin
  select coalesce(sum(amount) filter (where type = 'PURCHASE'), 0),
         coalesce(sum(amount) filter (where type = 'PAYMENT'), 0),
         count(*)
    into v_credit, v_pay, v_cnt
    from public.transactions t
   where shop_id = v_shop and occurred_at >= v_start
     and type in ('PURCHASE', 'PAYMENT')
     and not exists (select 1 from public.transactions r where r.reverses_transaction_id = t.id);
  select coalesce(sum(amount), 0) into v_cash from public.cash_sales
   where shop_id = v_shop and occurred_at >= v_start and voided_at is null;
  select coalesce(sum(outstanding) filter (where outstanding > 0), 0), count(*)
    into v_out, v_cust
    from public.customer_balances b join public.customers c on c.id = b.customer_id
   where b.shop_id = v_shop and c.is_active;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_pending from (
    select c.id, c.name, c.phone, b.outstanding, b.last_txn_at
      from public.customer_balances b join public.customers c on c.id = b.customer_id
     where b.shop_id = v_shop and c.is_active and b.outstanding > 0
     order by b.outstanding desc limit 6) x;
  select coalesce(jsonb_agg(w order by w.day), '[]'::jsonb) into v_week from (
    select d::date as day,
      coalesce((select sum(amount) from public.transactions t where t.shop_id = v_shop and t.type = 'PAYMENT'
        and (t.occurred_at at time zone 'Asia/Kolkata')::date = d::date
        and not exists (select 1 from public.transactions r where r.reverses_transaction_id = t.id)), 0) as payments,
      coalesce((select sum(amount) from public.transactions t where t.shop_id = v_shop and t.type = 'PURCHASE'
        and (t.occurred_at at time zone 'Asia/Kolkata')::date = d::date
        and not exists (select 1 from public.transactions r where r.reverses_transaction_id = t.id)), 0) as credit
    from generate_series(((now() at time zone 'Asia/Kolkata')::date - 6), (now() at time zone 'Asia/Kolkata')::date, interval '1 day') d) w;
  select coalesce(jsonb_agg(r), '[]'::jsonb) into v_recent from (
    select t.id, t.type, t.amount, t.description, t.payment_method, t.occurred_at, t.customer_id, c.name as customer_name,
           exists (select 1 from public.transactions x where x.reverses_transaction_id = t.id) as is_reversed
      from public.transactions t join public.customers c on c.id = t.customer_id
     where t.shop_id = v_shop order by t.occurred_at desc limit 8) r;
  return jsonb_build_object(
    'today_credit', v_credit, 'today_payments', v_pay, 'today_cash_sales', v_cash,
    'today_sales', v_credit + v_cash, 'today_txn_count', v_cnt,
    'total_outstanding', v_out, 'customer_count', v_cust,
    'pending_customers', v_pending, 'week', v_week, 'recent', v_recent);
end $$;

-- Reports: purchases and payments are kept separate (collections are never "sales").
create function public.report_range(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_shop uuid := public.require_shop();
  v_days jsonb; v_tot jsonb;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then
    raise exception 'INVALID_DATE' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(d order by d.day), '[]'::jsonb) into v_days from (
    select g::date as day,
      coalesce((select sum(amount) from public.transactions t where t.shop_id = v_shop and t.type = 'PURCHASE'
         and (t.occurred_at at time zone 'Asia/Kolkata')::date = g::date
         and not exists (select 1 from public.transactions r where r.reverses_transaction_id = t.id)), 0) as credit_purchases,
      coalesce((select sum(amount) from public.transactions t where t.shop_id = v_shop and t.type = 'PAYMENT'
         and (t.occurred_at at time zone 'Asia/Kolkata')::date = g::date
         and not exists (select 1 from public.transactions r where r.reverses_transaction_id = t.id)), 0) as payments,
      coalesce((select sum(amount) from public.cash_sales s where s.shop_id = v_shop and s.voided_at is null
         and (s.occurred_at at time zone 'Asia/Kolkata')::date = g::date), 0) as cash_sales
    from generate_series(p_from, p_to, interval '1 day') g) d;
  select jsonb_build_object(
    'credit_purchases', coalesce(sum((x->>'credit_purchases')::numeric), 0),
    'payments',         coalesce(sum((x->>'payments')::numeric), 0),
    'cash_sales',       coalesce(sum((x->>'cash_sales')::numeric), 0)) into v_tot
    from jsonb_array_elements(v_days) x;
  return jsonb_build_object(
    'days', v_days, 'totals', v_tot,
    'total_sales', (v_tot->>'credit_purchases')::numeric + (v_tot->>'cash_sales')::numeric,
    'outstanding_now', (select coalesce(sum(outstanding) filter (where outstanding > 0), 0)
                          from public.customer_balances where shop_id = v_shop),
    'customers_pending', (select count(*) from public.customer_balances where shop_id = v_shop and outstanding > 0));
end $$;

-- lock down function execution: only signed-in users
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.current_shop_id(), public.create_purchase(uuid, numeric, text, jsonb, uuid, timestamptz),
  public.create_payment(uuid, numeric, public.pay_method, text, uuid, timestamptz),
  public.create_adjustment(uuid, numeric, text, uuid), public.reverse_transaction(uuid, text, uuid),
  public.create_cash_sale(numeric, text, uuid, timestamptz), public.void_cash_sale(uuid, text),
  public.bootstrap_shop(text), public.dashboard_summary(), public.report_range(date, date)
  to authenticated;
-- trigram operator functions etc. stay with their extension owners
