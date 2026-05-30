-- External-wallet Mini App payment tracking.
-- Run this once after scripts/001_init_schema.sql on existing Supabase projects.

create table if not exists public.tg_external_tip_payments (
  id uuid primary key default gen_random_uuid(),
  tip_id uuid not null references public.tg_tips(id) on delete cascade,
  sender_user_id uuid not null references public.tg_users(id) on delete cascade,
  recipient_user_id uuid not null references public.tg_users(id) on delete cascade,
  sender_address text not null,
  recipient_address text not null,
  provider text not null,
  asset text not null,
  amount text not null,
  reference text,
  body_base64_hash text,
  boc text,
  tx_hash text,
  trace_id text,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tg_external_tip_payments enable row level security;

alter table public.tg_external_tip_payments
  add column if not exists tip_id uuid references public.tg_tips(id) on delete cascade,
  add column if not exists sender_user_id uuid references public.tg_users(id) on delete cascade,
  add column if not exists recipient_user_id uuid references public.tg_users(id) on delete cascade,
  add column if not exists sender_address text,
  add column if not exists recipient_address text,
  add column if not exists provider text,
  add column if not exists asset text,
  add column if not exists amount text,
  add column if not exists reference text,
  add column if not exists body_base64_hash text,
  add column if not exists boc text,
  add column if not exists tx_hash text,
  add column if not exists trace_id text,
  add column if not exists status text not null default 'pending',
  add column if not exists error text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists tg_external_tip_payments_tip_idx
  on public.tg_external_tip_payments(tip_id);

create unique index if not exists tg_external_tip_payments_reference_idx
  on public.tg_external_tip_payments(reference)
  where reference is not null;

create index if not exists tg_external_tip_payments_sender_idx
  on public.tg_external_tip_payments(sender_user_id);

create index if not exists tg_external_tip_payments_status_idx
  on public.tg_external_tip_payments(status);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tg_external_tip_payments_updated on public.tg_external_tip_payments;
create trigger tg_external_tip_payments_updated before update on public.tg_external_tip_payments
  for each row execute function public.touch_updated_at();
