# Production Deployment on Vercel Hobby

This project can run on Vercel Hobby, but Telegram bot confirmations execute inside Vercel serverless functions. Keep command batches small and test with low-value mainnet TON first.

## 1. Supabase

Run `scripts/001_init_schema.sql` in the Supabase SQL editor before deploying.

Confirm these tables exist:

- `tg_users`
- `tg_wallets`
- `tg_swaps`
- `tg_tips`
- `tg_external_tip_payments`
- `tg_tip_batches`
- `tg_tip_claims`
- `tg_group_messages`
- `waitlist`

If your database already has the older schema, run `scripts/002_external_tip_payments.sql` once instead of rerunning the full init script.

Use the Supabase project API URL for `NEXT_PUBLIC_SUPABASE_URL`, not the Postgres connection string.

## 2. Vercel Project

Import `https://github.com/zynorr/tipswap.git` into Vercel.

Use the defaults:

- Framework preset: Next.js
- Install command: `pnpm install`
- Build command: `pnpm build`
- Output directory: Next.js default

Keep **Fluid Compute** enabled in Vercel. New Vercel projects generally have it enabled by default. The webhook route declares `maxDuration = 300`, which gives the bot enough room for on-chain confirmation polling on the Hobby plan.

## 3. Environment Variables

Set these in Vercel for Production:

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_APP_URL` | Public Vercel URL, e.g. `https://tipswap.vercel.app` |
| `NEXT_ALLOWED_DEV_ORIGINS` | Leave unset in production |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |
| `TELEGRAM_BOT_USERNAME` | Bot username without `@`, e.g. `tipswapperbot` |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Same bot username, exposed to the Mini App for fallback links |
| `TELEGRAM_WEBHOOK_SECRET` | Random 32+ character secret |
| `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` | Optional; defaults to `604800` (7 days). Controls how long a Telegram Mini App session remains valid server-side |
| `ADMIN_SETUP_TOKEN` | Random 32+ character admin token |
| `WALLET_ENCRYPTION_KEY` | Random 32+ character encryption key |
| `TON_API_KEY` | TONCenter API key |
| `TONPAY_CHAIN` | `mainnet` |
| `TONPAY_API_KEY` | Optional TON Pay Merchant API key for dashboard tracking |
| `TONPAY_WEBHOOK_SECRET` | Optional TON Pay webhook secret from the TON Pay Merchant Dashboard |

Do not set a Postgres connection string as `NEXT_PUBLIC_SUPABASE_URL`.

Do not rotate `WALLET_ENCRYPTION_KEY` after users create managed wallets. Existing wallet mnemonics depend on it.

Mini App authentication uses the deployed `TELEGRAM_BOT_TOKEN` to verify Telegram `initData`. If the Mini App opens from `@tipswapperbot`, Vercel must use that exact bot's token. A token from an older bot will cause `Telegram initData hash is invalid`.

Telegram `initData` also includes an `auth_date`. TipSwap accepts it for 7 days by default, then asks the user to reopen the Mini App from Telegram so Telegram can issue fresh signed session data.

Generate strong secrets locally:

```bash
openssl rand -base64 32
```

## 4. Deploy

Deploy from Vercel after setting env vars.

After deploy, verify:

```bash
curl https://<your-vercel-domain>/api/bot
```

Expected:

```json
{"ok":true,"bot":"tipswap"}
```

Also verify the TON Connect manifest:

```text
https://<your-vercel-domain>/tonconnect-manifest.json
```

## 5. Set Telegram Webhook

Open:

```text
https://<your-vercel-domain>/admin/setup
```

Paste `ADMIN_SETUP_TOKEN`, confirm the URL field is your production Vercel URL, then click **Set webhook**.

The webhook should be:

```text
https://<your-vercel-domain>/api/bot
```

In BotFather, set the Mini App / Web App URL to:

```text
https://<your-vercel-domain>/miniapp
```

Also set the bot profile image with BotFather `/setuserpic` using `public/telegram-bot-avatar.png` if it has not been uploaded yet.

If you use the optional TON Pay Merchant Dashboard, set its webhook URL to:

```text
https://<your-vercel-domain>/api/tonpay/webhook
```

Allowed updates should include:

- `message`
- `callback_query`
- `message_reaction`

You can also set it with curl:

```bash
curl -X POST https://<your-vercel-domain>/api/bot/setup \
  -H "authorization: Bearer $ADMIN_SETUP_TOKEN" \
  -H "content-type: application/json" \
  --data '{"action":"set","url":"https://<your-vercel-domain>"}'
```

## 6. BotFather Settings

For reaction tipping in groups, disable privacy mode:

```text
/setprivacy
```

Choose the bot, then choose `Disable`.

Reaction tips only work for group messages the bot sees after being added to the group.

## 7. Smoke Test

Use two Telegram accounts.

For the full normal-user walkthrough, use `docs/telegram-user-test-guide.md`.

From both:

```text
/start
/wallet
/balance
```

Open the Mini App from the `/start` or `/help` link and confirm the wallet dashboard loads.

Fund the sender managed wallet with a small TON amount.

Test direct TON tip:

```text
/tip 0.02 TON @recipientusername
```

If `@recipientusername` has not started the bot, the sender should receive a claim link. Send that link to the recipient, then confirm the quote from the sender account after the recipient opens it.

Test STON.fi route:

```text
/tip 0.1 USDT @recipientusername
```

Test batch limit:

```text
/tip 0.02 TON @userone @usertwo @userthree
```

Production currently limits batch tips to 3 recipients because each recipient is a separate transaction inside one Vercel Hobby function.

## 8. Operational Notes

- Use mainnet only and start with small amounts.
- Managed wallets send bot-signed tips and swaps from Telegram commands.
- External wallets can receive tips, and can send Mini App tips by signing with TON Connect. Same-token external sends use TON Pay; cross-token external sends use STON.fi transaction messages.
- STON.fi quote failures are expected for illiquid routes. Try TON -> USDT or TON -> STON first.
- TON Pay webhooks only finalize TON Pay direct external-wallet transfers. STON.fi external swaps are submitted through the wallet and remain `sending` until separate chain reconciliation is added.
- If Telegram reports webhook errors, check `/admin/setup` and Vercel function logs.
- If webhook executions time out, confirm Fluid Compute is enabled in Vercel project settings.
- If TON RPC rate limits appear, confirm `TON_API_KEY` is set in Vercel Production.
