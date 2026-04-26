-- TipSwap Milestone 1 schema
-- Tables: tg_users, tg_wallets, tg_swaps, waitlist
-- Service-role only access. RLS enforced on all tables.

-- ------------------------------------------------------------------
-- waitlist (used by the public landing page form)
-- ------------------------------------------------------------------
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  telegram_handle text,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

drop policy if exists "waitlist_insert_anyone" on public.waitlist;
create policy "waitlist_insert_anyone"
  on public.waitlist for insert
  to anon, authenticated
  with check (true);

-- ------------------------------------------------------------------
-- tg_users — one row per Telegram user
-- ------------------------------------------------------------------
create table if not exists public.tg_users (
  id uuid primary key default gen_random_uuid(),
  tg_id bigint not null unique,
  tg_username text,
  first_name text,
  default_recv_token text default 'USDT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tg_users enable row level security;
-- no policies = service role only

-- ------------------------------------------------------------------
-- tg_wallets — managed wallet per user
-- ------------------------------------------------------------------
create table if not exists public.tg_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.tg_users(id) on delete cascade,
  address text not null,
  public_key text not null,
  encrypted_mnemonic text not null,
  mode text not null default 'managed',
  created_at timestamptz not null default now(),
  unique(user_id)
);

alter table public.tg_wallets enable row level security;

-- ------------------------------------------------------------------
-- tg_swaps — every swap attempted via the bot
-- ------------------------------------------------------------------
create table if not exists public.tg_swaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.tg_users(id) on delete cascade,
  offer_token text not null,
  ask_token text not null,
  offer_amount text not null,
  expected_out text,
  slippage_bps int not null default 100,
  tx_hash text,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tg_swaps enable row level security;

create index if not exists tg_swaps_user_idx on public.tg_swaps(user_id);
create index if not exists tg_swaps_status_idx on public.tg_swaps(status);

-- ------------------------------------------------------------------
-- updated_at trigger
-- ------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tg_users_updated on public.tg_users;
create trigger tg_users_updated before update on public.tg_users
  for each row execute function public.touch_updated_at();

drop trigger if exists tg_swaps_updated on public.tg_swaps;
create trigger tg_swaps_updated before update on public.tg_swaps
  for each row execute function public.touch_updated_at();
