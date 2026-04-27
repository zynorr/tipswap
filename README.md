# TipSwap

A Telegram bot that lets users tip each other in any TON-based token. The sender pays in their preferred token, the recipient receives in theirs, and STON.fi handles the swap atomically in between.

This repository contains:

- A marketing landing page with a 3D animated background, built with Next.js, Tailwind CSS, and React Three Fiber.
- A Telegram bot (grammY) that creates a managed TON wallet for each user and executes real on-chain swaps via the STON.fi DEX v2 SDK.
- An admin dashboard for registering the Telegram webhook and inspecting bot status.
- A Supabase-backed data layer for users, wallets, swaps, and waitlist signups.

---

## Tech stack

| Layer            | Technology                                          |
| ---------------- | --------------------------------------------------- |
| Framework        | Next.js 16 (App Router) on Node.js runtime          |
| Styling          | Tailwind CSS v4, framer-motion                      |
| 3D scene         | React Three Fiber, three.js, @react-three/drei      |
| Database         | Supabase (Postgres) with Row Level Security         |
| Telegram bot     | grammY                                              |
| Blockchain SDK   | @ston-fi/sdk (DEX v2), @ton/ton, @ton/core          |
| Wallet custody   | TON v4 wallets, AES-256-GCM encrypted at rest       |

---

## Repository layout

```
app/
  page.tsx                    Landing page
  admin/setup/page.tsx        Webhook management dashboard
  api/
    bot/route.ts              Telegram webhook receiver
    bot/setup/route.ts        Webhook register/inspect/delete API
    waitlist/route.ts         Landing page waitlist API
components/
  site/                       Landing page sections (hero, features, etc.)
  ui/                         shadcn-style primitives
lib/
  bot/                        grammY bot definition and user repository
  ston/swap.ts                STON.fi swap execution helper
  supabase/                   Supabase client variants
  wallet/                     TON wallet generation and AES-256-GCM crypto
scripts/
  001_init_schema.sql         Database migration
```

---

## Database schema

Four tables, all in the `public` schema with Row Level Security enabled.

| Table        | Purpose                                              |
| ------------ | ---------------------------------------------------- |
| `tg_users`   | Telegram user records keyed by `tg_id`               |
| `tg_wallets` | One managed TON wallet per user, mnemonic encrypted  |
| `tg_swaps`   | Swap audit log: tokens, amounts, tx hash, status     |
| `waitlist`   | Public landing page email signups                    |

The migration is in `scripts/001_init_schema.sql`. It runs idempotently and creates an `updated_at` trigger function used by `tg_users` and `tg_swaps`.

---

## Environment variables

| Variable                          | Required | Description                                                  |
| --------------------------------- | -------- | ------------------------------------------------------------ |
| `TELEGRAM_BOT_TOKEN`              | yes      | Token from `@BotFather`                                      |
| `TELEGRAM_WEBHOOK_SECRET`         | yes      | Random string used to verify webhook calls                   |
| `WALLET_ENCRYPTION_KEY`           | yes      | 32+ char string used to encrypt user mnemonics at rest       |
| `STON_NETWORK`                    | yes      | `mainnet` or `testnet`                                       |
| `TON_API_KEY`                     | no       | TONCenter API key for higher RPC rate limits                 |
| `SUPABASE_URL`                    | yes      | Set by the Supabase integration                              |
| `SUPABASE_SERVICE_ROLE_KEY`       | yes      | Set by the Supabase integration                              |
| `NEXT_PUBLIC_SUPABASE_URL`        | yes      | Set by the Supabase integration                              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | yes      | Set by the Supabase integration                              |

---

## Local development

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The landing page works out of the box. To exercise the bot, you need a publicly reachable URL so Telegram can deliver webhook events. Use a tunnel (for example `ngrok http 3000`) and point your bot at the tunnel URL.

---

## Deployment

This project deploys to Vercel as a standard Next.js app.

1. Push to your default branch (Vercel auto-deploys).
2. Confirm all environment variables in the Vercel dashboard.
3. Run the migration in `scripts/001_init_schema.sql` against your Supabase project (one time).
4. Visit `https://<your-domain>/admin/setup`, paste the public URL, and click **Set webhook**. This registers the webhook with Telegram.
5. Open the bot in Telegram and send `/start`.

---

## Bot commands

| Command                        | Behaviour                                                              |
| ------------------------------ | ---------------------------------------------------------------------- |
| `/start`                       | Creates a user record and a managed TON wallet, returns the address    |
| `/wallet`                      | Shows the wallet address, current TON balance, and active network      |
| `/help`                        | Lists available commands                                               |
| `/swap <amount> <from> <to>`   | Executes a STON.fi swap from the user's managed wallet                 |

Supported tokens: `TON`, `USDT`, `STON`, `NOT`. Slippage defaults to 1%.

> Note: STON.fi DEX v2 pools live on mainnet only. Set `STON_NETWORK=mainnet` to enable real `/swap` execution. On testnet, `/start`, `/wallet`, and `/help` work; `/swap` will fail because the pools do not exist there.

---

## Security notes

- Wallet mnemonics are encrypted with AES-256-GCM using a key derived from `WALLET_ENCRYPTION_KEY` via scrypt. They are never logged.
- The Telegram webhook validates the `X-Telegram-Bot-Api-Secret-Token` header on every request and rejects mismatched calls with 401.
- The `tg_users`, `tg_wallets`, and `tg_swaps` tables have RLS enabled with no public policies; only the service role (used by the bot) can read or write them.
- Swap execution uses a managed hot wallet per user. Production deployments should cap per-user balances and add per-command rate limits.

---

## License

MIT.
