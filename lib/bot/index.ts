import "server-only"
import { Bot } from "grammy"
import { getOrCreateUser, decryptMnemonic, logSwap, updateSwapStatus, type TgWallet } from "./users"
import { getBalance, getNetwork } from "@/lib/wallet/ton"
import { executeSwap, resolveToken, SwapNetworkError } from "@/lib/ston/swap"
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
            `Welcome to TipSwap, ${tgUser.first_name ?? "friend"}.`,
            "",
            "I just spun up a managed TON wallet for you:",
            `<code>${wallet.address}</code>`,
            "",
            `Network: <b>${getNetwork()}</b>`,
            "",
            "Top it up, then try:",
            "<code>/swap 0.1 TON USDT</code>",
            "",
            "Other commands:",
            "/wallet — show address &amp; balance",
            "/help — full command list",
          ]
        : [
            `Welcome back, ${user.first_name ?? "friend"}.`,
            "",
            `Wallet: <code>${wallet.address}</code>`,
            "Try /wallet, /swap, or /help.",
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
        "/swap &lt;amount&gt; &lt;from&gt; &lt;to&gt; — swap one token for another",
        "  example: <code>/swap 0.5 TON USDT</code>",
        "",
        `Currently on <b>${getNetwork()}</b>.`,
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
        ].join("\n"),
        { parse_mode: "HTML" },
      )
    } catch (err) {
      console.error("[tipswap] /wallet failed:", err)
      await ctx.reply("Couldn't fetch your wallet. Try again shortly.")
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
      await ctx.reply(`${(err as Error).message}\nSupported: TON, USDT, STON, NOT`)
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
      `Swapping <b>${amountStr} ${offer.toUpperCase()}</b> → <b>${ask.toUpperCase()}</b>...\nThis can take 10–30 seconds.`,
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

      await updateSwapStatus(log.id as string, {
        status: result.sent ? "sent" : "failed",
        error: result.sent ? undefined : "Transaction did not confirm in time",
      })

      if (result.sent) {
        await ctx.reply(
          [
            `Swap broadcast on <b>${result.network}</b>.`,
            `Seqno: ${result.seqno}`,
            "Track confirmations on tonviewer.com (paste your wallet address).",
          ].join("\n"),
          { parse_mode: "HTML" },
        )
      } else {
        await ctx.reply("Swap was broadcast but didn't confirm in time. Check your wallet shortly.")
      }
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      console.error("[tipswap] /swap failed:", err)
      await updateSwapStatus(log.id as string, {
        status: "failed",
        error: msg.slice(0, 300),
      })

      if (err instanceof SwapNetworkError) {
        await ctx.reply(
          [
            "<b>Swaps require mainnet.</b>",
            "STON.fi DEX is only deployed on TON mainnet — testnet has no liquidity.",
            "",
            "Ask the operator to set <code>STON_NETWORK=mainnet</code> and fund the bot wallet with real TON.",
          ].join("\n"),
          { parse_mode: "HTML" },
        )
        return
      }

      // Friendlier message for the most common SDK quote-fetch failure
      if (/exit_code: -13/i.test(msg) || /Unable to execute get method/i.test(msg)) {
        await ctx.reply(
          [
            "<b>Couldn't fetch a quote for that pair.</b>",
            "Either the pool doesn't exist on STON.fi, or the network is misconfigured.",
            "",
            "Try a major pair like <code>/swap 0.1 TON USDT</code> on mainnet.",
          ].join("\n"),
          { parse_mode: "HTML" },
        )
        return
      }

      await ctx.reply(`Swap failed: ${msg}`)
    }
  })

  bot.catch((err) => {
    console.error("[tipswap] bot.catch:", err)
  })

  _bot = bot
  return bot
}
