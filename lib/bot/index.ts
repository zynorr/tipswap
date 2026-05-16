import "server-only"
import { Bot } from "grammy"
import { getOrCreateUser, decryptMnemonic, logSwap, updateSwapStatus, type TgUser, type TgWallet } from "./users"
import { getBalance, getJettonBalance, getNetworkDisplay } from "@/lib/wallet/ton"
import { executeSwap, resolveToken, TOKENS } from "@/lib/ston/swap"
import { fromNano } from "@ton/core"

const TOKEN = process.env.TELEGRAM_BOT_TOKEN

let _bot: Bot | null = null

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
            `<b>✨ Welcome to TipSwap, ${tgUser.first_name ?? "friend"}!</b>`,
            "",
            "I just created a managed TON wallet for you:",
            `<code>${wallet.address}</code>`,
            "",
            `📡 <b>${getNetworkDisplay()}</b>`,
            "",
            "Send some TON to this address, then try a swap:",
            "<code>/swap 0.1 TON USDT</code>",
            "",
            "<b>Commands</b>",
            "/wallet   —  view address &amp; TON balance",
            "/balance  —  view TON, USDT &amp; STON balances",
            "/help     —  full command list",
          ]
        : [
            `<b>👋 Welcome back, ${user.first_name ?? "friend"}!</b>`,
            "",
            `Wallet: <code>${wallet.address}</code>`,
            "",
            "Try /balance, /wallet, /swap, or /help.",
          ]

      await ctx.reply(lines.join("\n"), { parse_mode: "HTML" })
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      console.error("[tipswap] /start failed:", err)
      await ctx.reply(`Setup failed: ${msg}`)
    }
  })

  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        "<b>🤖 TipSwap Help</b>",
        "",
        "<b>Commands</b>",
        "/start    —  register or restore your wallet",
        "/wallet   —  show address &amp; TON balance",
        "/balance  —  show TON, USDT &amp; STON balances",
        "/swap &lt;amount&gt; &lt;from&gt; &lt;to&gt;  —  cross-token swap",
        "",
        "<b>Example</b>",
        "<code>/swap 0.5 TON USDT</code>",
        "",
        "<b>Supported tokens</b>",
        Object.keys(TOKENS).join(", "),
        "",
        `📡 <b>${getNetworkDisplay()}</b>`,
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
          `<b>💼 Your TipSwap Wallet</b>`,
          "",
          `<code>${wallet.address}</code>`,
          "",
          `💰 Balance: <b>${ton} TON</b>`,
          `📡 ${getNetworkDisplay()}`,
          `🎯 Receive as: ${user.default_recv_token}`,
        ].join("\n"),
        { parse_mode: "HTML" },
      )
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      console.error("[tipswap] /wallet failed:", err)
      await ctx.reply(`Wallet lookup failed: ${msg}`)
    }
  })

  bot.command("balance", async (ctx) => {
    const tgUser = ctx.from
    if (!tgUser) return

    try {
      const { wallet } = await getOrCreateUser({
        tgId: tgUser.id,
        tgUsername: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
      })

      const [tonBal, usdtBal, stonBal] = await Promise.all([
        getBalance(wallet.address),
        getJettonBalance(wallet.address, TOKENS.USDT.mainnet),
        getJettonBalance(wallet.address, TOKENS.STON.mainnet),
      ])

      // USDT uses 6 decimals, TON/STON use 9
      const usdtDiv = 1_000_000n
      const usdtWhole = usdtBal / usdtDiv
      const usdtFrac = (usdtBal % usdtDiv).toString().padStart(6, "0").slice(0, 4)

      const txLink = `https://tonviewer.com/${wallet.address}`

      await ctx.reply(
        [
          `<b>💰 Token Balances</b>`,
          "",
          `TON:   <b>${fromNano(tonBal)}</b>`,
          `USDT:  <b>${usdtWhole}.${usdtFrac}</b>`,
          `STON:  <b>${fromNano(stonBal)}</b>`,
          "",
          `📡 ${getNetworkDisplay()}`,
          `🔗 <a href="${txLink}">View on tonviewer.com</a>`,
        ].join("\n"),
        { parse_mode: "HTML" },
      )
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      console.error("[tipswap] /balance failed:", err)
      await ctx.reply(`Balance lookup failed: ${msg}`)
    }
  })

  bot.command("swap", async (ctx) => {
    const tgUser = ctx.from
    if (!tgUser) return

    const args = ctx.match?.toString().trim().split(/\s+/) ?? []
    if (args.length !== 3) {
      await ctx.reply("Usage: /swap <amount> <from> <to>\nexample: /swap 0.1 TON USDT")
      return
    }
    const [amountStr, offer, ask] = args

    if (!/^\d+(\.\d+)?$/.test(amountStr)) {
      await ctx.reply("Amount must be a number. Example: 0.5")
      return
    }

    let user: TgUser
    let wallet: TgWallet
    try {
      const r = await getOrCreateUser({
        tgId: tgUser.id,
        tgUsername: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
      })
      user = r.user
      wallet = r.wallet
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      console.error("[tipswap] /swap user lookup failed:", err)
      await ctx.reply(`Wallet lookup failed: ${msg}`)
      return
    }

    try {
      resolveToken(offer)
      resolveToken(ask)
    } catch (err) {
      await ctx.reply(
        `${(err as Error).message}\nSupported: ${Object.keys(TOKENS).join(", ")}`,
      )
      return
    }

    const log = await logSwap({
      userId: user.id,
      offer: offer.toUpperCase(),
      ask: ask.toUpperCase(),
      offerAmount: amountStr,
      slippageBps: 100,
      status: "pending",
    })

    await ctx.reply(
      [
        `🔄 Swapping <b>${amountStr} ${offer.toUpperCase()}</b> → <b>${ask.toUpperCase()}</b>...`,
        "This can take 10–30 seconds.",
      ].join("\n"),
      { parse_mode: "HTML" },
    )

    try {
      const mnemonic = await decryptMnemonic(wallet)
      const result = await executeSwap({
        mnemonic,
        userAddress: wallet.address,
        offer,
        ask,
        offerAmount: amountStr,
        slippageBps: 100,
      })

      await updateSwapStatus(log.id, {
        status: result.sent ? "sent" : "failed",
        error: result.sent ? undefined : "Transaction did not confirm in time",
      })

      if (result.sent) {
        const txLink = `https://tonviewer.com/${wallet.address}`
        await ctx.reply(
          [
            `<b>✅ Swap complete!</b>`,
            "",
            `Swapped <b>${amountStr} ${offer.toUpperCase()}</b> → <b>${ask.toUpperCase()}</b>`,
            `📡 ${getNetworkDisplay()}`,
            `🔢 Seqno: ${result.seqno}`,
            `🔗 <a href="${txLink}">View on tonviewer.com</a>`,
          ].join("\n"),
          { parse_mode: "HTML" },
        )
      } else {
        await ctx.reply(
          [
            `<b>⚠️ Transaction pending</b>`,
            "",
            `Swapped <b>${amountStr} ${offer.toUpperCase()}</b> → <b>${ask.toUpperCase()}</b>`,
            "The transaction was broadcast but hasn't confirmed yet.",
            "Check your wallet balance again shortly.",
          ].join("\n"),
          { parse_mode: "HTML" },
        )
      }
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      console.error("[tipswap] /swap failed:", err)
      await updateSwapStatus(log.id, {
        status: "failed",
        error: msg.slice(0, 300),
      })
      await ctx.reply(`Swap failed: ${msg}`)
    }
  })

  bot.catch((err) => {
    console.error("[tipswap] bot.catch:", err)
  })

  _bot = bot
  return bot
}
