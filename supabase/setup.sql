-- ===========================================================================
-- Water Billing System — ONE-TIME SETUP (tables + security + sample data)
-- HOW TO RUN: Supabase dashboard → SQL Editor → New query → paste ALL → Run
-- Safe to run more than once.
-- ===========================================================================

-- 1) TABLES ----------------------------------------------------------------
create table if not exists consumers (
  id              uuid primary key default gen_random_uuid(),
  consumer_no     text unique not null,
  name            text not null,
  meter_no        text,
  address         text,
  category        text not null default 'domestic',
  metered         boolean not null default true,
  prev_reading    numeric not null default 0,
  opening_arrears numeric not null default 0,
  phone           text,
  status          text not null default 'active',
  created_at      timestamptz default now()
);

create table if not exists transactions (
  id           uuid primary key default gen_random_uuid(),
  consumer_id  uuid references consumers(id) on delete cascade,
  type         text not null check (type in ('bill','payment')),
  amount       numeric not null,
  date         text,
  meta         jsonb,
  created_at   timestamptz default now()
);
create index if not exists idx_txn_consumer on transactions(consumer_id);

create table if not exists settings (
  id         int primary key default 1,
  tariff     jsonb not null,
  scheme     jsonb,
  updated_at timestamptz default now(),
  constraint settings_singleton check (id = 1)
);

-- 2) SECURITY (only logged-in staff can read/write) ------------------------
alter table consumers    enable row level security;
alter table transactions enable row level security;
alter table settings     enable row level security;

drop policy if exists "staff all consumers"    on consumers;
drop policy if exists "staff all transactions" on transactions;
drop policy if exists "staff all settings"     on settings;

create policy "staff all consumers"    on consumers    for all to authenticated using (true) with check (true);
create policy "staff all transactions" on transactions for all to authenticated using (true) with check (true);
create policy "staff all settings"     on settings     for all to authenticated using (true) with check (true);

-- 3) SAMPLE DATA (delete later; harmless to keep for the demo) --------------
insert into consumers (consumer_no,name,meter_no,address,category,metered,prev_reading,opening_arrears,phone,status) values
 ('KWS-1001','Rajan Nair','M-101','Ward 3, Thevally','domestic',true,1200,0,'98470 11111','active'),
 ('KWS-1002','Suja Kumari','M-102','Ward 3, Thevally','domestic',true,850,150,'98470 22222','active'),
 ('KWS-1003','Ayesha Beevi','F-201','Ward 4, Kavanad','domestic',false,0,300,'98470 33333','active'),
 ('KWS-1004','Krishna Stores','M-301','Ward 4, Main Road','commercial',true,3000,540,'98470 44444','active'),
 ('KWS-1005','Beena Thomas','M-103','Ward 3, Thevally','domestic',true,400,80,'98470 55555','active'),
 ('KWS-1006','Faisal M','M-104','Ward 5, Uliyakovil','domestic',true,1560,0,'98470 66666','active')
on conflict (consumer_no) do nothing;

insert into settings (id, tariff, scheme) values (
  1,
  '{"unitLabel":"unit (1000 L)","categories":{"domestic":{"label":"Domestic","ratePerUnit":6,"fixedCharge":30},"commercial":{"label":"Commercial","ratePerUnit":12,"fixedCharge":60}},"flatRate":{"domestic":100,"commercial":200}}'::jsonb,
  '{"name":"Kollam Drinking Water Scheme","malayalamName":"കൊല്ലം കുടിവെള്ള പദ്ധതി","subtitle":"Thevally · Kavanad · Uliyakovil","phone":"+91 90379 79978","upi":{"vpa":"kollamwater@sbi","payeeName":"Kollam Water Scheme","account":"SBI · A/c 3021 5566 7788 · IFSC SBIN0001234"}}'::jsonb
) on conflict (id) do nothing;
