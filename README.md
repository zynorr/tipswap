# TipSwap

TipSwap is a Telegram bot, and a small operational dashboard for running token tips on TON.

At a high level:

- users interact with the bot in Telegram
- the app provisions a managed TON wallet per user
- swaps are routed through STON.fi on `mainnet`
- Supabase stores users, wallets, swap attempts, and waitlist signups

## What is in this repo

- A public landing page
- A Telegram bot built with `grammy`
- A webhook setup dashboard for registering and inspecting the Telegram webhook
- A Supabase-backed persistence layer for bot and waitlist data

## Stack

| Layer | Technology |
| --- | --- |
| App framework | Next.js 16 App Router |
| Runtime | Node.js |
| UI | React 19, Tailwind CSS v4, framer-motion |
| Telegram bot | `grammy` |
| TON / swaps | `@ton/ton`, `@ton/core`, `@ston-fi/sdk` |
| Database | Supabase Postgres |
| Wallet custody | Managed TON v4 wallets with encrypted mnemonics |

## Architecture

The application is organized around a few core flows:

1. `Telegram -> webhook -> bot handlers`
   Telegram sends updates to `app/api/bot/route.ts`, which forwards them into the `grammy` bot defined under `lib/bot/`.

2. `Bot command -> wallet/user lookup -> blockchain action`
   Commands such as `/start`, `/wallet`, and `/swap` resolve a user, load or create a managed wallet, and either read on-chain state or construct a swap transaction.

3. `Bot/admin actions -> Supabase`
   The bot uses a server-side Supabase client for user, wallet, and swap persistence. The public landing page writes waitlist signups through its own API route.

4. `Admin dashboard -> Telegram Bot API`
   The setup page under `app/admin/setup/page.tsx` calls `app/api/bot/setup/route.ts` to inspect, set, or delete the webhook.

## Project layout

```text
app/
  page.tsx                    Landing page
  admin/setup/page.tsx        Webhook management UI
  api/
    bot/route.ts              Telegram webhook receiver
    bot/setup/route.ts        Webhook management API
    waitlist/route.ts         Public waitlist API

components/
  site/                       Marketing site sections
  ui/                         Shared UI primitives

lib/
  bot/                        Telegram bot handlers and persistence helpers
  ston/                       Swap construction and user-facing swap errors
  supabase/                   Browser/server/admin Supabase clients
  wallet/                     TON wallet generation, encryption, RPC helpers

scripts/
  001_init_schema.sql         Initial database schema
```

## Product behavior

### Supported bot commands

| Command | Description |
| --- | --- |
| `/start` | Creates or fetches the user record and managed wallet |
| `/wallet` | Shows wallet address and current TON balance |
| `/help` | Lists supported commands |
| `/swap <amount> <from> <to>` | Attempts a token swap from the managed wallet |

Current supported swap symbols in code:

- `TON`
- `USDT`
- `STON`

### Mainnet-only operation

This project is configured for TON `mainnet`.

STON.fi swap execution in this app assumes:

- `STON_NETWORK=mainnet`
- mainnet wallet formatting
- mainnet router configuration
- mainnet liquidity availability

Do not deploy this app expecting testnet swap support.

## Database

The schema lives in `scripts/001_init_schema.sql`.

Tables created by the migration:

| Table | Purpose |
| --- | --- |
| `waitlist` | Public landing page signups |
| `tg_users` | Telegram users keyed by `tg_id` |
| `tg_wallets` | One managed wallet per user |
| `tg_swaps` | Swap attempts, status, and error history |

Operational notes:

- RLS is enabled on all tables
- `waitlist` allows public inserts
- bot tables are intended for service-role access only
- `tg_users` and `tg_swaps` use an `updated_at` trigger

## Environment variables

### Required

| Variable | Purpose |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from `@BotFather` |
| `TELEGRAM_WEBHOOK_SECRET` | Secret token validated on webhook requests |
| `WALLET_ENCRYPTION_KEY` | Symmetric key material for mnemonic encryption |
| `STON_NETWORK` | Must be `mainnet` |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase anon key |

### Server-side Supabase

The admin Supabase client accepts either of the following:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SECRET_KEY`

It also accepts `SUPABASE_URL`, but falls back to `NEXT_PUBLIC_SUPABASE_URL` if needed.

### Optional

| Variable | Purpose |
| --- | --- |
| `TON_API_KEY` | TONCenter API key for higher RPC rate limits and more reliable wallet/swap operations |

## Local development

### Requirements

- Node.js 20+
- `pnpm`

### Install

```bash
pnpm install
```

### Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Local bot testing

Telegram requires a public webhook URL. For local testing, expose your dev server with a tunnel such as:

```bash
ngrok http 3000
```

Then register the webhook against the public URL using the admin setup page or the webhook setup API.

## Deployment notes

### Vercel

For production deployment:

1. configure all required environment variables in Vercel
2. ensure `STON_NETWORK=mainnet`
3. add `TON_API_KEY` to reduce TONCenter throttling
4. deploy
5. register the Telegram webhook against the canonical production domain

Important: Telegram webhooks should point to the final canonical domain, not a redirecting preview domain.

### Telegram webhook

The webhook endpoint is:

```text
/api/bot
```

The webhook setup/inspection API is:

```text
/api/bot/setup
```

The webhook handler validates the `X-Telegram-Bot-Api-Secret-Token` header using `TELEGRAM_WEBHOOK_SECRET`.

## Operational notes

### Error handling

The bot attempts to return user-facing swap failures in plain language instead of raw infrastructure errors. Current handling includes:

- TON balance preflight for swap gas
- friendlier TON RPC error messages
- retry/backoff for TONCenter `429` responses
- clearer swap route/provider failure messaging

### Hot wallet model

This project uses a managed per-user wallet model. That is convenient for prototyping, but it carries operational risk. Production deployments should add:

- per-user balance limits
- withdrawal / recovery policy
- rate limiting
- monitoring and alerting
- audit logging beyond the current swap record

## Security

- Wallet mnemonics are encrypted at rest before persistence
- Sensitive Supabase operations use a server-side admin client
- Webhook requests are verified with a shared secret
- RLS is enabled across the schema

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Start local development server |
| `pnpm build` | Build the app for production |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |

## License

MIT
