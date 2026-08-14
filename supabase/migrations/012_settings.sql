-- ============================================================
-- Toastmasters Roles — Migration 012: Settings Table
-- ============================================================
-- Creates the settings table to store dynamic app configurations
-- like VPED email and Resend API key.
-- ============================================================

create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Seed defaults
insert into settings (key, value)
values 
  ('vped_email', 'parastiwari013@gmail.com'),
  ('resend_api_key', '')
on conflict (key) do nothing;

-- Enable RLS and create policy (anyone authenticated or using admin can read/write)
alter table settings enable row level security;
create policy "public read settings" on settings for select using (true);
create policy "public write settings" on settings for insert with check (true);
create policy "public update settings" on settings for update using (true);
