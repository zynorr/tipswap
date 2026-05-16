# TipSwap

**Telegram-native token tipping on TON, powered by STON.fi.**

TipSwap is a Telegram bot that lets anyone tip TON, USDT, or STON tokens to any Telegram user — even when the sender and recipient hold different tokens. The bot quotes and executes a cross-token swap on STON.fi behind the scenes, so the recipient gets the token they want without ever opening a DEX.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Telegram                             │
│  User sends /swap 0.1 TON USDT                              │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS webhook (X-Telegram-Bot-Api-Secret-Token verified)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Next.js (Vercel)                            │
│                                                             │
│  ┌──────────────┐    ┌──────────────────────────────────┐   │
│  │ /api/bot     │───▶│ grammY command handlers          │   │
│  │ (webhook RX) │    │  /start  /wallet  /balance       │   │
│  └──────────────┘    │  /help    /swap                   │   │
│                      └───────┬──────────────────────────┘   │
│                              │                              │
│         ┌────────────────────┼────────────────────┐         │
│         ▼                    ▼                    ▼         │
│  ┌───────────┐     ┌──────────────┐     ┌───────────────┐   │
│  │ Supabase  │     │ TON RPC      │     │ STON.fi SDK   │   │
│  │ (ledger)  │     │ (TONCenter)  │     │ CPIRouterV2_2 │   │
│  │           │     │              │     │ + pTON v2.1   │   │
│  │ users     │     │ balance      │     │               │   │
│  │ wallets   │     │ seqno        │     │ swap tx       │   │
│  │ swaps     │     │ broadcast    │     │ construction  │   │
│  └───────────┘     └──────┬───────┘     └───────┬───────┘   │
│                           └─────────┬───────────┘           │
│                                     ▼                      │
│                            ┌────────────────┐              │
│                            │ TON Mainnet    │              │
│                            │ (blockchain)   │              │
│                            └────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

**Data flow for a swap:**

1. User sends `/swap 0.1 TON USDT` in a Telegram chat
2. Telegram delivers the update to `POST /api/bot` with a signed secret token
3. The grammY bot handler resolves the user and their managed wallet from Supabase
4. A TON balance preflight checks the wallet has enough TON for gas + swap amount
5. The STON.fi SDK builds the swap transaction (TON→pTON→Jetton routing via CPIRouterV2_2)
6. The bot signs and broadcasts the transaction through TONCenter RPC
7. The bot polls the wallet seqno to confirm the transaction landed
8. The swap result (seqno, transaction link) is returned to the user in Telegram

---

## Stack

| Layer | Technology |
|---|---|
| App framework | [Next.js 16](https://nextjs.org) (App Router) |
| Runtime | Node.js |
| UI | React 19, [Tailwind CSS v4](https://tailwindcss.com), [framer-motion](https://motion.dev) |
| Telegram bot | [grammY](https://grammy.dev) |
| TON blockchain | [`@ton/ton`](https://www.npmjs.com/package/@ton/ton), [`@ton/core`](https://www.npmjs.com/package/@ton/core) |
| DEX integration | [`@ston-fi/sdk`](https://www.npmjs.com/package/@ston-fi/sdk) |
| Database | Supabase (PostgreSQL) |
| Wallet model | Managed TON v4 wallets, AES-256-GCM encrypted mnemonics |

---

## Project layout

```
app/
  page.tsx                     Landing page
  admin/setup/page.tsx         Webhook management UI
  api/
    bot/route.ts               Telegram webhook receiver
    bot/setup/route.ts         Webhook setup/inspection API
    waitlist/route.ts          Public waitlist signup

components/
  site/                        Marketing sections (hero, features, waitlist)
  ui/                          Shared Radix UI primitives

lib/
  bot/
    index.ts                   grammY command handlers
    users.ts                   Supabase helpers for users, wallets, swaps
  ston/
    swap.ts                    STON.fi swap construction, quote preflight, gas estimation
  supabase/
    admin.ts                   Server-side admin client (service role)
    client.ts                  Browser client
    server.ts                  Server component client
    types.ts                   Generated type definitions
  wallet/
    ton.ts                     TON client, wallet generation, balance, broadcast
    crypto.ts                  AES-256-GCM mnemonic encryption/decryption

scripts/
  001_init_schema.sql          Database migration
```

---

## Bot commands

| Command | Description |
|---|---|
| `/start` | Register or restore your managed wallet |
| `/wallet` | Show wallet address and TON balance |
| `/balance` | Show TON, USDT, and STON balances |
| `/swap <amount> <from> <to>` | Execute a cross-token swap |
| `/help` | Full command reference |

**Supported tokens:** `TON`, `USDT`, `STON`

**Example:**
```
/swap 0.1 TON USDT
```
The bot checks the balance, estimates gas, queries the pool for a quote, executes the swap on STON.fi, and confirms with an on-chain transaction link.

---

## Database

The schema lives in `scripts/001_init_schema.sql`. Four tables, all with RLS enabled:

| Table | Purpose | Access |
|---|---|---|
| `waitlist` | Public landing page signups | Anonymous inserts allowed |
| `tg_users` | Telegram user records, keyed by `tg_id` | Service role only |
| `tg_wallets` | Managed wallets (encrypted mnemonics) per user | Service role only |
| `tg_swaps` | Swap attempt ledger with status and error history | Service role only |

A `touch_updated_at()` trigger maintains `updated_at` on `tg_users` and `tg_swaps`.

---

## Environment variables

### Required

| Variable | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_WEBHOOK_SECRET` | Secret token validated on incoming webhook requests |
| `ADMIN_SETUP_TOKEN` | Bearer token for webhook setup API access (production) |
| `WALLET_ENCRYPTION_KEY` | Symmetric key for AES-256-GCM mnemonic encryption (min 32 chars) |
| `STON_NETWORK` | Must be `mainnet` |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase anon key |

### Server-side Supabase

The admin client accepts either of:
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SECRET_KEY`

It also accepts `SUPABASE_URL`, falling back to `NEXT_PUBLIC_SUPABASE_URL`.

### Optional

| Variable | Purpose |
|---|---|
| `TON_API_KEY` | TONCenter API key for higher rate limits and more reliable swap execution |

---

## Local development

**Requirements:** Node.js 20+, `pnpm`

```bash
# Install dependencies
pnpm install

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Testing the bot locally

Telegram requires a public HTTPS webhook URL. Use a tunnel:

```bash
ngrok http 3000
```

Then register the webhook via the admin dashboard at `/admin/setup` or directly through the setup API. The public URL will be pre-filled — just paste your `ADMIN_SETUP_TOKEN` and click **Set webhook**.

---

## Deployment

### Vercel

1. Configure all required environment variables in the Vercel dashboard
2. Ensure `STON_NETWORK=mainnet`
3. Add `TON_API_KEY` to avoid TONCenter throttling
4. Deploy from `main`
5. Register the Telegram webhook against your production domain

### Telegram webhook

The webhook endpoint:

```
POST /api/bot
```

The setup/inspection API (admin-token protected in production):

```
GET|POST /api/bot/setup
```

The webhook handler validates the `X-Telegram-Bot-Api-Secret-Token` header on every request. Requests without the correct secret receive a `403` response.

---

## Security

- Wallet mnemonics are encrypted at rest with AES-256-GCM and scrypt-derived keys before being stored in Supabase
- All database operations for bot data use a service-role client that bypasses RLS — this client is never exposed to the browser
- Webhook requests are verified with a shared secret token
- The webhook setup API requires `Authorization: Bearer <ADMIN_SETUP_TOKEN>` in production
- RLS is enabled on all database tables; public access is limited to the `waitlist` table

---

## Operational notes

### Error handling

- TON balance preflight runs before every swap to prevent gas-out failures
- TONCenter HTTP 429 responses trigger exponential backoff (up to 5 retries)
- RPC 500 errors produce user-friendly messages instead of raw tracebacks
- Swap route failures are surfaced clearly with recovery suggestions

### Hot wallet model

The bot uses managed per-user wallets. This is convenient for onboarding but carries operational risk. Production deployments should add:
- Per-user balance and volume limits
- Wallet export / self-custody graduation
- Rate limiting on commands
- Monitoring and alerting

### Slippage

Current swap execution stores the `slippageBps` parameter but defaults to a permissive `minAskAmount` of 1 raw unit. Production deployments should compute the minimum output from a real-time pool quote before broadcasting.

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start the local dev server |
| `pnpm build` | Production build |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm verify` | Typecheck + lint + build (CI) |

---

## License

MIT
