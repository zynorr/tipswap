-- TipSwap Milestone 1 schema
-- Tables: tg_users, tg_wallets, tg_swaps, tg_tips, waitlist
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

alter table public.tg_users
  add column if not exists reaction_tip_amount text not null default '1',
  add column if not exists reaction_recv_token text not null default 'USDT',
  add column if not exists reaction_pay_token text not null default 'TON';

-- ------------------------------------------------------------------
-- tg_wallets — managed or external wallet per user
-- ------------------------------------------------------------------
create table if not exists public.tg_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.tg_users(id) on delete cascade,
  address text not null,
  public_key text,
  encrypted_mnemonic text,
  mode text not null default 'managed',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id, mode)
);

alter table public.tg_wallets enable row level security;

alter table public.tg_wallets
  alter column public_key drop not null,
  alter column encrypted_mnemonic drop not null;

alter table public.tg_wallets
  add column if not exists is_active boolean not null default true;

alter table public.tg_wallets
  drop constraint if exists tg_wallets_user_id_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tg_wallets_user_id_mode_key'
      and conrelid = 'public.tg_wallets'::regclass
  ) then
    alter table public.tg_wallets add constraint tg_wallets_user_id_mode_key unique(user_id, mode);
  end if;
end;
$$;

create unique index if not exists tg_wallets_one_active_idx
  on public.tg_wallets(user_id)
  where is_active;

create index if not exists tg_wallets_user_mode_idx on public.tg_wallets(user_id, mode);

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
-- tg_tips — quoted and confirmed direct-recipient tips
-- ------------------------------------------------------------------
create table if not exists public.tg_tips (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.tg_users(id) on delete cascade,
  recipient_user_id uuid not null references public.tg_users(id) on delete cascade,
  sender_wallet_id uuid references public.tg_wallets(id) on delete set null,
  recipient_wallet_id uuid references public.tg_wallets(id) on delete set null,
  recipient_address text not null,
  offer_token text not null,
  ask_token text not null,
  ask_amount text not null,
  ask_raw text not null,
  quoted_offer_amount text,
  offer_raw text,
  expected_out text,
  min_ask_amount text,
  slippage_bps int not null default 100,
  status text not null default 'quoted',
  tx_hash text,
  error text,
  expires_at timestamptz not null default now() + interval '5 minutes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tg_tips enable row level security;

alter table public.tg_tips
  add column if not exists batch_id uuid,
  add column if not exists source text not null default 'command',
  add column if not exists source_chat_id bigint,
  add column if not exists source_message_id bigint,
  add column if not exists sender_wallet_id uuid references public.tg_wallets(id) on delete set null,
  add column if not exists recipient_wallet_id uuid references public.tg_wallets(id) on delete set null,
  add column if not exists recipient_address text,
  add column if not exists ask_raw text,
  add column if not exists quoted_offer_amount text,
  add column if not exists offer_raw text,
  add column if not exists expected_out text,
  add column if not exists min_ask_amount text,
  add column if not exists slippage_bps int not null default 100,
  add column if not exists status text not null default 'quoted',
  add column if not exists tx_hash text,
  add column if not exists error text,
  add column if not exists expires_at timestamptz not null default now() + interval '5 minutes',
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.tg_tip_batches (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.tg_users(id) on delete cascade,
  source text not null default 'command',
  offer_token text not null,
  ask_token text not null,
  ask_amount text not null,
  recipient_count int not null default 1,
  quoted_total_offer_amount text,
  status text not null default 'quoted',
  error text,
  expires_at timestamptz not null default now() + interval '5 minutes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tg_tip_batches enable row level security;

alter table public.tg_tip_batches
  add column if not exists sender_user_id uuid references public.tg_users(id) on delete cascade,
  add column if not exists source text not null default 'command',
  add column if not exists offer_token text,
  add column if not exists ask_token text,
  add column if not exists ask_amount text,
  add column if not exists recipient_count int not null default 1,
  add column if not exists quoted_total_offer_amount text,
  add column if not exists status text not null default 'quoted',
  add column if not exists error text,
  add column if not exists expires_at timestamptz not null default now() + interval '5 minutes',
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.tg_group_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null,
  message_id bigint not null,
  author_user_id uuid not null references public.tg_users(id) on delete cascade,
  author_tg_id bigint not null,
  author_username text,
  created_at timestamptz not null default now(),
  unique(chat_id, message_id)
);

alter table public.tg_group_messages enable row level security;

alter table public.tg_group_messages
  add column if not exists author_user_id uuid references public.tg_users(id) on delete cascade,
  add column if not exists author_tg_id bigint,
  add column if not exists author_username text;

alter table public.tg_tips
  drop constraint if exists tg_tips_batch_id_fkey;

alter table public.tg_tips
  add constraint tg_tips_batch_id_fkey
  foreign key (batch_id) references public.tg_tip_batches(id) on delete set null;

create index if not exists tg_tips_sender_idx on public.tg_tips(sender_user_id);
create index if not exists tg_tips_recipient_idx on public.tg_tips(recipient_user_id);
create index if not exists tg_tips_status_idx on public.tg_tips(status);
create index if not exists tg_tips_expires_idx on public.tg_tips(expires_at);
create index if not exists tg_tips_batch_idx on public.tg_tips(batch_id);
create index if not exists tg_tip_batches_sender_idx on public.tg_tip_batches(sender_user_id);
create index if not exists tg_tip_batches_status_idx on public.tg_tip_batches(status);
create index if not exists tg_tip_batches_expires_idx on public.tg_tip_batches(expires_at);
create index if not exists tg_group_messages_author_idx on public.tg_group_messages(author_user_id);

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

drop trigger if exists tg_tips_updated on public.tg_tips;
create trigger tg_tips_updated before update on public.tg_tips
  for each row execute function public.touch_updated_at();

drop trigger if exists tg_tip_batches_updated on public.tg_tip_batches;
create trigger tg_tip_batches_updated before update on public.tg_tip_batches
  for each row execute function public.touch_updated_at();
