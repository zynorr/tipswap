import "server-only"
import { Bot } from "grammy"
import { fromNano } from "@ton/core"
import {
  getOrCreateUser,
  decryptMnemonic,
  logSwap,
  updateSwapStatus,
  type TgWallet,
} from "./users"
import { getBalance, getNetwork } from "@/lib/wallet/ton"
import {
  executeSwap,
  quoteSwap,
  resolveToken,
  assertSufficientTon,
  TOKENS,
  SwapNetworkError,
  InsufficientFundsError,
  QuoteError,
} from "@/lib/ston/swap"

const TOKEN = process.env.TELEGRAM_BOT_TOKEN

let _bot: Bot | null = null

const SUPPORTED_LIST = Object.keys(TOKENS).join(", ")

export function getBot(): Bot {
  if (_bot) return _bot
  if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set")

  const bot = new Bot(TOKEN)

  bot.command("start", async (ctx) => {
    const tgUser = ctx.from
    if (!tgUser) return

    try {
      const { user, wallet, created } = await getOrCreateUser({
        tgId: tgUser.id,
        tgUsername: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
      })

      const lines = created
        ? [
            `Welcome to TipSwap, ${tgUser.first_name ?? "friend"}.`,
            "",
            "I just spun up a managed TON wallet for you:",
            `<code>${wallet.address}</code>`,
            "",
            `Network: <b>${getNetwork()}</b>`,
            "",
            "Top it up with at least <b>0.5 TON</b>, then try:",
            "<code>/quote 0.1 TON USDT</code> — preview a swap",
            "<code>/swap 0.1 TON USDT</code>  — execute it",
            "",
            "Other commands: /wallet, /help",
          ]
        : [
            `Welcome back, ${user.first_name ?? "friend"}.`,
            "",
            `Wallet: <code>${wallet.address}</code>`,
            "Try /wallet, /quote, /swap, or /help.",
          ]

      await ctx.reply(lines.join("\n"), { parse_mode: "HTML" })
    } catch (err) {
      console.error("[tipswap] /start failed:", err)
      await ctx.reply("Something went wrong setting up your wallet. Try again in a minute.")
    }
  })

  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        "<b>TipSwap commands</b>",
        "",
        "/start — register and get a wallet",
        "/wallet — show your address and TON balance",
        "/quote &lt;amount&gt; &lt;from&gt; &lt;to&gt; — preview a swap (no broadcast)",
        "  example: <code>/quote 0.5 TON USDT</code>",
        "/swap &lt;amount&gt; &lt;from&gt; &lt;to&gt; — execute a swap",
        "  example: <code>/swap 0.5 TON USDT</code>",
        "",
        `Supported tokens: ${SUPPORTED_LIST}`,
        `Network: <b>${getNetwork()}</b>`,
      ].join("\n"),
      { parse_mode: "HTML" },
    )
  })

  bot.command("wallet", async (ctx) => {
    const tgUser = ctx.from
    if (!tgUser) return

    try {
      const { user, wallet } = await getOrCreateUser({
        tgId: tgUser.id,
        tgUsername: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
      })

      const balance = await getBalance(wallet.address)
      const ton = fromNano(balance)

      await ctx.reply(
        [
          `<b>Your TipSwap wallet</b>`,
          `<code>${wallet.address}</code>`,
          "",
          `Balance: <b>${ton} TON</b>`,
          `Network: ${getNetwork()}`,
          `Default receive token: ${user.default_recv_token}`,
          "",
          "Send TON to this address to fund swaps. ~0.3 TON of gas is reserved per swap.",
        ].join("\n"),
        { parse_mode: "HTML" },
      )
    } catch (err) {
      console.error("[tipswap] /wallet failed:", err)
      await ctx.reply("Couldn't fetch your wallet. Try again shortly.")
    }
  })

  bot.command("quote", async (ctx) => {
    const args = ctx.match?.toString().trim().split(/\s+/) ?? []
    if (args.length !== 3) {
      await ctx.reply(
        "Usage: /quote <amount> <from> <to>\nexample: /quote 0.1 TON USDT",
      )
      return
    }
    const [amountStr, offer, ask] = args

    if (!/^\d+(\.\d+)?$/.test(amountStr)) {
      await ctx.reply("Amount must be a number. Example: 0.5")
      return
    }

    try {
      resolveToken(offer)
      resolveToken(ask)
    } catch (err) {
      await ctx.reply(`${(err as Error).message}\nSupported: ${SUPPORTED_LIST}`)
      return
    }

    try {
      const q = await quoteSwap({
        offer,
        ask,
        offerAmount: amountStr,
        slippageBps: 100,
      })
      await ctx.reply(formatQuoteMessage(q), { parse_mode: "HTML" })
    } catch (err) {
      await ctx.reply(formatSwapError(err))
    }
  })

  bot.command("swap", async (ctx) => {
    const tgUser = ctx.from
    if (!tgUser) return

    const args = ctx.match?.toString().trim().split(/\s+/) ?? []
    if (args.length !== 3) {
      await ctx.reply(
        "Usage: /swap <amount> <from> <to>\nexample: /swap 0.1 TON USDT",
      )
      return
    }
    const [amountStr, offer, ask] = args

    if (!/^\d+(\.\d+)?$/.test(amountStr)) {
      await ctx.reply("Amount must be a number. Example: 0.5")
      return
    }

    let user, wallet: TgWallet
    try {
      const r = await getOrCreateUser({
        tgId: tgUser.id,
        tgUsername: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
      })
      user = r.user
      wallet = r.wallet
    } catch (err) {
      console.error("[tipswap] /swap user lookup failed:", err)
      await ctx.reply("Couldn't load your wallet. Try /start first.")
      return
    }

    try {
      resolveToken(offer)
      resolveToken(ask)
    } catch (err) {
      await ctx.reply(`${(err as Error).message}\nSupported: ${SUPPORTED_LIST}`)
      return
    }

    // 1. Get a quote so we know expected output and the right router
    let quote
    try {
      quote = await quoteSwap({
        offer,
        ask,
        offerAmount: amountStr,
        slippageBps: 100,
      })
    } catch (err) {
      await ctx.reply(formatSwapError(err))
      return
    }

    // 2. Pre-flight balance check
    try {
      const balance = await getBalance(wallet.address)
      assertSufficientTon({
        balance,
        offerSymbol: quote.offer.symbol,
        offerUnits: quote.offerUnits,
      })
    } catch (err) {
      await ctx.reply(formatSwapError(err))
      return
    }

    // 3. Log the pending swap, broadcast, update.
    const log = await logSwap({
      userId: user.id,
      offer: quote.offer.symbol,
      ask: quote.ask.symbol,
      offerAmount: amountStr,
      slippageBps: 100,
      status: "pending",
    })

    await ctx.reply(
      [
        formatQuoteMessage(quote),
        "",
        "<i>Broadcasting now... 10–30 seconds.</i>",
      ].join("\n"),
      { parse_mode: "HTML" },
    )

    try {
      const mnemonic = await decryptMnemonic(wallet)
      const result = await executeSwap({
        mnemonic,
        userAddress: wallet.address,
        quote,
      })

      await updateSwapStatus(log.id as string, {
        status: result.sent ? "sent" : "failed",
        error: result.sent ? undefined : "Transaction did not confirm in time",
      })

      if (result.sent) {
        await ctx.reply(
          [
            `<b>Swap broadcast on ${result.network}.</b>`,
            `Expected: ~${result.expectedOut} ${quote.ask.symbol}`,
            `Min received: ${result.minOut} ${quote.ask.symbol}`,
            `Wallet seqno: ${result.seqno}`,
            "",
            `Track on tonviewer.com/${wallet.address}`,
          ].join("\n"),
          { parse_mode: "HTML" },
        )
      } else {
        await ctx.reply(
          "Swap was sent but the wallet didn't confirm in time. Check your address on tonviewer.com shortly — it may still land.",
        )
      }
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      console.error("[tipswap] /swap failed:", err)
      await updateSwapStatus(log.id as string, {
        status: "failed",
        error: msg.slice(0, 300),
      })
      await ctx.reply(formatSwapError(err))
    }
  })

  bot.catch((err) => {
    console.error("[tipswap] bot.catch:", err)
  })

  _bot = bot
  return bot
}

function formatQuoteMessage(q: Awaited<ReturnType<typeof quoteSwap>>) {
  const impactPct = (Number(q.priceImpact) * 100).toFixed(3)
  const feePct = (Number(q.feePercent) * 100).toFixed(3)
  return [
    `<b>${q.offerAmount} ${q.offer.symbol} → ~${q.askFormatted} ${q.ask.symbol}</b>`,
    `Min received (1% slippage): ${q.minAskFormatted} ${q.ask.symbol}`,
    `Rate: 1 ${q.offer.symbol} = ${q.swapRate} ${q.ask.symbol}`,
    `Price impact: ${impactPct}% · Pool fee: ${feePct}%`,
    `Routed via STON.fi (pTON v${q.ptonVersion})`,
  ].join("\n")
}

function formatSwapError(err: unknown): string {
  if (err instanceof SwapNetworkError) {
    return [
      "<b>Swaps require mainnet.</b>",
      "STON.fi DEX is only deployed on TON mainnet — testnet has no liquidity.",
      "",
      "Operator: set <code>STON_NETWORK=mainnet</code> on the server and redeploy.",
    ].join("\n")
  }

  if (err instanceof InsufficientFundsError) {
    return [
      "<b>Not enough TON to cover swap + gas.</b>",
      err.message,
      "",
      "Send more TON to your wallet (run /wallet to see the address) and try again.",
    ].join("\n")
  }

  if (err instanceof QuoteError) {
    return [
      "<b>STON.fi couldn't quote that pair right now.</b>",
      err.message,
      "",
      "Common causes: pair has no pool, or amount is below the pool minimum. Try a major pair like TON / USDT.",
    ].join("\n")
  }

  const msg = (err as Error)?.message ?? String(err)
  if (/exit_code: -13/i.test(msg) || /Unable to execute get method/i.test(msg)) {
    return [
      "<b>The router contract didn't respond.</b>",
      "Usually means the network is misconfigured or the pool no longer exists.",
      "",
      "Try a different pair, or contact the operator.",
    ].join("\n")
  }

  return `Swap failed: ${msg}`
}
