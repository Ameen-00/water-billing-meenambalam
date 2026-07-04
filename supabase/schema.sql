-- ===========================================================================
-- Water Billing System — database schema
-- HOW TO RUN: Supabase dashboard → SQL Editor → New query → paste all → Run
-- ===========================================================================

-- 1) CONSUMERS -------------------------------------------------------------
create table if not exists consumers (
  id              uuid primary key default gen_random_uuid(),
  consumer_no     text unique not null,
  name            text not null,
  meter_no        text,
  address         text,
  category        text not null default 'domestic',   -- domestic | commercial | institutional
  metered         boolean not null default true,      -- false = flat-rate (no meter)
  prev_reading    numeric not null default 0,
  opening_arrears numeric not null default 0,          -- old unpaid balance (backlog)
  phone           text,
  status          text not null default 'active',      -- active | disconnected
  created_at      timestamptz default now()
);

-- 2) TRANSACTIONS (bills + payments = the running ledger) ------------------
create table if not exists transactions (
  id           uuid primary key default gen_random_uuid(),
  consumer_id  uuid references consumers(id) on delete cascade,
  type         text not null check (type in ('bill','payment')),
  amount       numeric not null,
  date         text,
  meta         jsonb,                                  -- billNo/charge OR receiptNo/payerName/reference/mode
  created_at   timestamptz default now()
);
create index if not exists idx_txn_consumer on transactions(consumer_id);

-- 3) SETTINGS (tariff + scheme info; single row) ---------------------------
create table if not exists settings (
  id         int primary key default 1,
  tariff     jsonb not null,
  scheme     jsonb,
  updated_at timestamptz default now(),
  constraint settings_singleton check (id = 1)
);

-- 4) SECURITY --------------------------------------------------------------
-- Only logged-in staff (reader/admin) can read or change data.
alter table consumers    enable row level security;
alter table transactions enable row level security;
alter table settings     enable row level security;

create policy "staff read consumers"    on consumers    for select to authenticated using (true);
create policy "staff write consumers"   on consumers    for all    to authenticated using (true) with check (true);
create policy "staff read transactions" on transactions for select to authenticated using (true);
create policy "staff write transactions" on transactions for all   to authenticated using (true) with check (true);
create policy "staff read settings"     on settings     for select to authenticated using (true);
create policy "staff write settings"    on settings     for all    to authenticated using (true) with check (true);
