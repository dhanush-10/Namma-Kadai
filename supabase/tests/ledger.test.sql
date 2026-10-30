-- Ledger + RLS tests. Run with: psql -v ON_ERROR_STOP=1 -f supabase/tests/ledger.test.sql
-- Each check raises an exception on failure.
\set ON_ERROR_STOP on
\set owner_a '11111111-1111-1111-1111-111111111111'
\set owner_b '22222222-2222-2222-2222-222222222222'

create schema if not exists th;
grant usage on schema th to anon, authenticated;
create or replace function th.expect(p_label text, p_ok boolean) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAIL: %', p_label; end if;
  raise notice 'PASS: %', p_label;
end $$;
create or replace function th.expect_error(p_label text, p_sql text, p_code text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm like '%' || p_code || '%' then raise notice 'PASS: % (%)', p_label, p_code; return; end if;
    raise exception 'FAIL: % — wrong error: %', p_label, sqlerrm;
  end;
  raise exception 'FAIL: % — no error raised', p_label;
end $$;

grant execute on all functions in schema th to anon, authenticated;
insert into auth.users values (:'owner_a'), (:'owner_b');

-- ===== Shop A setup =====
set role authenticated; select set_config('request.jwt.claim.sub', :'owner_a', false);
select public.bootstrap_shop('Test Shop A');
insert into public.customers (shop_id, name, phone, opening_balance)
  values (public.current_shop_id(), 'Ravi', '9876543210', 0) returning id \gset ravi_
-- psql variable ravi_id now holds the customer id

-- S1: purchase 100
select (public.create_purchase(:'ravi_id', 100, 'milk', null, 'a0000000-0000-0000-0000-000000000001')->>'outstanding')::numeric = 100 as ok \gset s1_
select th.expect('S1 purchase 100 -> outstanding 100', :'s1_ok'::boolean);
-- S2: +200
select (public.create_purchase(:'ravi_id', 200, null, null, 'a0000000-0000-0000-0000-000000000002')->>'outstanding')::numeric = 300 as ok \gset s2_
select th.expect('S2 purchase 200 -> outstanding 300', :'s2_ok'::boolean);
-- S3: payment 150
select (public.create_payment(:'ravi_id', 150, 'CASH', null, 'a0000000-0000-0000-0000-000000000003')->>'outstanding')::numeric = 150 as ok \gset s3_
select th.expect('S3 payment 150 -> outstanding 150', :'s3_ok'::boolean);
-- S4: +50
select (public.create_purchase(:'ravi_id', 50, null, null, 'a0000000-0000-0000-0000-000000000004')->>'outstanding')::numeric = 200 as ok \gset s4_
select th.expect('S4 purchase 50 -> outstanding 200', :'s4_ok'::boolean);
-- S5: persists (re-read from ledger)
select th.expect('S5 outstanding persists = 200',
  (select outstanding from public.customer_balances where customer_id = :'ravi_id') = 200);

-- S8: duplicate submission
select (public.create_purchase(:'ravi_id', 50, null, null, 'a0000000-0000-0000-0000-000000000004')->>'duplicate')::boolean as dup \gset s8_
select th.expect('S8 duplicate flagged', :'s8_dup'::boolean);
select th.expect('S8 no double entry (4 txns, outstanding 200)',
  (select count(*) from public.transactions where customer_id = :'ravi_id') = 4
  and (select outstanding from public.customer_balances where customer_id = :'ravi_id') = 200);

-- S9: invalid payments/purchases
select th.expect_error('payment over outstanding', format($q$select public.create_payment(%L, 999, 'CASH', null, gen_random_uuid())$q$, :'ravi_id'), 'PAYMENT_EXCEEDS_OUTSTANDING');
select th.expect_error('payment zero', format($q$select public.create_payment(%L, 0, 'CASH', null, gen_random_uuid())$q$, :'ravi_id'), 'INVALID_AMOUNT');
select th.expect_error('negative purchase', format($q$select public.create_purchase(%L, -5, null, null, gen_random_uuid())$q$, :'ravi_id'), 'INVALID_AMOUNT');
select th.expect_error('3-decimal amount', format($q$select public.create_purchase(%L, 1.005, null, null, gen_random_uuid())$q$, :'ravi_id'), 'INVALID_AMOUNT');
select th.expect_error('items total mismatch', format($q$select public.create_purchase(%L, 100, null, '[{"name":"Milk","quantity":2,"unit_price":30}]'::jsonb, gen_random_uuid())$q$, :'ravi_id'), 'ITEMS_TOTAL_MISMATCH');
select public.create_purchase(:'ravi_id', 60, 'items', '[{"name":"Milk","quantity":2,"unit_price":30}]'::jsonb, gen_random_uuid());
select th.expect('item rows stored', (select count(*) from public.transaction_items) = 1);

-- immutability
select th.expect_error('cannot update txn', $q$update public.transactions set amount = 1$q$, 'permission denied');
select th.expect_error('cannot delete txn', $q$delete from public.transactions$q$, 'permission denied');
select th.expect_error('cannot insert txn directly', format($q$insert into public.transactions (shop_id, customer_id, type, amount, client_txn_id) values (public.current_shop_id(), %L, 'PURCHASE', 1, gen_random_uuid())$q$, :'ravi_id'), 'permission denied');
select th.expect_error('cannot change opening balance', format($q$update public.customers set opening_balance = 5 where id = %L$q$, :'ravi_id'), 'IMMUTABLE_RECORD');

-- reversal
select (public.reverse_transaction((select id from public.transactions where client_txn_id = 'a0000000-0000-0000-0000-000000000004'), 'entered by mistake', gen_random_uuid())->>'outstanding')::numeric = 210 as ok \gset rv_
-- 200 + 60 (items purchase) - 50 = 210
select th.expect('reversal restores balance (210)', :'rv_ok'::boolean);
select th.expect_error('double reversal blocked', $q$select public.reverse_transaction((select id from public.transactions where client_txn_id = 'a0000000-0000-0000-0000-000000000004'), 'again please', gen_random_uuid())$q$, 'ALREADY_REVERSED');
select th.expect('original txn still exists', (select count(*) from public.transactions where client_txn_id = 'a0000000-0000-0000-0000-000000000004') = 1);

-- dashboard + report
select th.expect('dashboard credit excludes reversed (today = 100+200+60)',
  (public.dashboard_summary()->>'today_credit')::numeric = 360);
select th.expect('dashboard payments = 150', (public.dashboard_summary()->>'today_payments')::numeric = 150);
select public.create_cash_sale(75, 'walk-in', gen_random_uuid());
select th.expect('sales = credit + cash (435)', (public.dashboard_summary()->>'today_sales')::numeric = 435);
select th.expect('report totals match dashboard',
  (public.report_range(current_date - 1, current_date + 1)->'totals'->>'payments')::numeric = 150);
select th.expect('audit trail written', (select count(*) from public.audit_log) >= 7);

-- ===== Shop B: isolation (S7) =====
select set_config('request.jwt.claim.sub', :'owner_b', false);
select th.expect_error('second shop setup closed', $q$select public.bootstrap_shop('Shop B')$q$, 'SETUP_CLOSED');
reset role;
insert into public.shops (id, name) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Shop B');
insert into public.profiles (id, shop_id) values (:'owner_b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
set role authenticated; select set_config('request.jwt.claim.sub', :'owner_b', false);
select th.expect('B sees no customers of A', (select count(*) from public.customers) = 0);
select th.expect('B sees no transactions of A', (select count(*) from public.transactions) = 0);
select th.expect_error('B cannot buy on A customer', format($q$select public.create_purchase(%L, 10, null, null, gen_random_uuid())$q$, :'ravi_id'), 'CUSTOMER_NOT_FOUND');
select th.expect_error('B cannot reverse A txn', $q$select public.reverse_transaction((select id from public.transactions limit 1), 'hacking', gen_random_uuid())$q$, 'TRANSACTION_NOT_FOUND');
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select th.expect_error('anonymous has no table access', $q$select * from public.customers$q$, 'permission denied');
reset role;
\echo ALL LEDGER TESTS PASSED
