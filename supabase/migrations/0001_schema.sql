-- NAMMA KADAI — 0001 schema
-- All money is NUMERIC(12,2) in INR. All timestamps are timestamptz (UTC);
-- the app displays them in Asia/Kolkata.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.txn_type  as enum ('PURCHASE', 'PAYMENT', 'ADJUSTMENT');
create type public.pay_method as enum ('CASH', 'UPI', 'OTHER');

create table public.shops (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  shop_id     uuid not null references public.shops (id) on delete restrict,
  full_name   text,
  role        text not null default 'OWNER' check (role in ('OWNER', 'STAFF')),
  created_at  timestamptz not null default now()
);
create index profiles_shop_idx on public.profiles (shop_id);

create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references public.shops (id) on delete restrict,
  customer_no      integer not null,
  name             text not null check (char_length(btrim(name)) between 1 and 100),
  phone            text check (phone is null or phone ~ '^[0-9+ -]{6,15}$'),
  address          text check (address is null or char_length(address) <= 300),
  notes            text check (notes is null or char_length(notes) <= 500),
  opening_balance  numeric(12,2) not null default 0
                   check (opening_balance between -10000000 and 10000000),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  created_by       uuid references auth.users (id) default auth.uid(),
  unique (id, shop_id),
  unique (shop_id, customer_no)
);
create index customers_name_trgm  on public.customers using gin (lower(name) extensions.gin_trgm_ops);
create index customers_phone_trgm on public.customers using gin (phone extensions.gin_trgm_ops);
create index customers_shop_idx   on public.customers (shop_id, is_active);

create table public.products (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops (id) on delete restrict,
  name           text not null check (char_length(btrim(name)) between 1 and 100),
  unit           text check (unit is null or char_length(unit) <= 20),
  default_price  numeric(10,2) not null default 0 check (default_price >= 0),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (shop_id, name)
);

create table public.transactions (
  id                       uuid primary key default gen_random_uuid(),
  shop_id                  uuid not null,
  customer_id              uuid not null,
  type                     public.txn_type not null,
  amount                   numeric(12,2) not null,
  description              text check (description is null or char_length(description) <= 500),
  payment_method           public.pay_method,
  client_txn_id            uuid not null,              -- idempotency key
  reverses_transaction_id  uuid references public.transactions (id),
  occurred_at              timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  created_by               uuid references auth.users (id) default auth.uid(),
  foreign key (customer_id, shop_id) references public.customers (id, shop_id) on delete restrict,
  unique (shop_id, client_txn_id),
  unique (id, shop_id),
  constraint amount_rules check (
    (type in ('PURCHASE', 'PAYMENT') and amount > 0 and amount <= 10000000)
    or (type = 'ADJUSTMENT' and amount <> 0 and abs(amount) <= 10000000)
  ),
  constraint method_rules check (
    (type = 'PAYMENT' and payment_method is not null)
    or (type <> 'PAYMENT' and payment_method is null)
  ),
  constraint reversal_rules check (
    reverses_transaction_id is null or type = 'ADJUSTMENT'
  )
);
create unique index transactions_one_reversal on public.transactions (reverses_transaction_id)
  where reverses_transaction_id is not null;
create index transactions_customer_idx on public.transactions (shop_id, customer_id, occurred_at desc);
create index transactions_shop_time_idx on public.transactions (shop_id, occurred_at desc);

create table public.transaction_items (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null,
  transaction_id  uuid not null,
  name            text not null check (char_length(btrim(name)) between 1 and 100),
  quantity        numeric(10,3) not null check (quantity > 0 and quantity <= 100000),
  unit_price      numeric(12,2) not null check (unit_price >= 0 and unit_price <= 10000000),
  line_total      numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  foreign key (transaction_id, shop_id) references public.transactions (id, shop_id) on delete restrict
);
create index transaction_items_txn_idx on public.transaction_items (transaction_id);

-- Walk-in cash sales (not tied to a customer, no credit).
create table public.cash_sales (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops (id) on delete restrict,
  amount         numeric(12,2) not null check (amount > 0 and amount <= 10000000),
  note           text check (note is null or char_length(note) <= 300),
  client_txn_id  uuid not null,
  occurred_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users (id) default auth.uid(),
  voided_at      timestamptz,
  voided_by      uuid references auth.users (id),
  void_reason    text,
  unique (shop_id, client_txn_id)
);
create index cash_sales_shop_time_idx on public.cash_sales (shop_id, occurred_at desc);

create table public.app_settings (
  shop_id        uuid primary key references public.shops (id) on delete cascade,
  language       text not null default 'ta' check (language in ('ta', 'en')),
  allow_advance  boolean not null default false,
  updated_at     timestamptz not null default now()
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  shop_id     uuid,
  user_id     uuid,
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_shop_idx on public.audit_log (shop_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Financial records are append-only.
-- ---------------------------------------------------------------------------
create function public.block_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'IMMUTABLE_RECORD: % on % is not allowed. Use a reversal/adjustment.', tg_op, tg_table_name
    using errcode = 'P0001';
end $$;

create trigger transactions_immutable before update or delete on public.transactions
  for each row execute function public.block_mutation();
create trigger transaction_items_immutable before update or delete on public.transaction_items
  for each row execute function public.block_mutation();
create trigger audit_log_immutable before update or delete on public.audit_log
  for each row execute function public.block_mutation();
create trigger customers_no_delete before delete on public.customers
  for each row execute function public.block_mutation();
create trigger cash_sales_no_delete before delete on public.cash_sales
  for each row execute function public.block_mutation();

-- cash_sales may only be voided (never edited)
create function public.cash_sales_guard() returns trigger language plpgsql as $$
begin
  if old.voided_at is not null
     or (new.amount, new.note, new.client_txn_id, new.occurred_at, new.shop_id)
        is distinct from (old.amount, old.note, old.client_txn_id, old.occurred_at, old.shop_id) then
    raise exception 'IMMUTABLE_RECORD: cash sales can only be voided' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger cash_sales_update_guard before update on public.cash_sales
  for each row execute function public.cash_sales_guard();

-- opening balance may only be set at creation; corrections go through adjustments
create function public.customers_guard() returns trigger language plpgsql as $$
begin
  if new.opening_balance is distinct from old.opening_balance
     or new.shop_id is distinct from old.shop_id then
    raise exception 'IMMUTABLE_RECORD: opening balance cannot be changed; record an adjustment'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger customers_update_guard before update on public.customers
  for each row execute function public.customers_guard();

-- per-shop friendly customer number
create function public.customers_assign_no() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('customer_no:' || new.shop_id::text));
  select coalesce(max(customer_no), 0) + 1 into new.customer_no
    from public.customers where shop_id = new.shop_id;
  return new;
end $$;
create trigger customers_assign_no before insert on public.customers
  for each row execute function public.customers_assign_no();

-- ---------------------------------------------------------------------------
-- Balances: Opening + Purchases - Payments + Adjustments (always from the ledger)
-- ---------------------------------------------------------------------------
create view public.customer_balances with (security_invoker = true) as
select
  c.id as customer_id,
  c.shop_id,
  c.opening_balance,
  coalesce(sum(t.amount) filter (where t.type = 'PURCHASE'), 0)   as total_purchases,
  coalesce(sum(t.amount) filter (where t.type = 'PAYMENT'), 0)    as total_payments,
  coalesce(sum(t.amount) filter (where t.type = 'ADJUSTMENT'), 0) as total_adjustments,
  c.opening_balance
    + coalesce(sum(t.amount) filter (where t.type = 'PURCHASE'), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'PAYMENT'), 0)
    + coalesce(sum(t.amount) filter (where t.type = 'ADJUSTMENT'), 0) as outstanding,
  max(t.occurred_at) filter (where t.type = 'PURCHASE') as last_purchase_at,
  max(t.occurred_at) filter (where t.type = 'PAYMENT')  as last_payment_at,
  max(t.occurred_at)                                    as last_txn_at
from public.customers c
left join public.transactions t on t.customer_id = c.id
group by c.id;

-- Transactions joined with customer name and "has this been reversed?"
create view public.v_transactions with (security_invoker = true) as
select
  t.*,
  c.name as customer_name,
  exists (select 1 from public.transactions r where r.reverses_transaction_id = t.id) as is_reversed
from public.transactions t
join public.customers c on c.id = t.customer_id;
