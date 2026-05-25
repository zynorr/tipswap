/**
 * @file Telegram bot command handlers.
 *
 * Architecture:
 *   - Single Bot instance created lazily via getBot()
 *   - Command handlers: /start, /wallet, /balance, /swap, /tip, /help
 *   - Each handler resolves the user + wallet via getOrCreateUser() first
 *   - /swap follows a state machine: validate → log → preflight → execute → update_status → respond
 *   - All responses use HTML parse_mode for formatting
 *   - Errors are caught per-command and surfaced to the user with the actual error message
 *
 * The bot is designed to be stateless — every request fetches user/wallet from Supabase
 * and chain state fresh from TON RPC.
 */
import "server-only"
import { Bot, InlineKeyboard } from "grammy"
import {
  getOrCreateUser,
  decryptMnemonic,
  logSwap,
  updateSwapStatus,
  connectExternalWallet,
  getManagedWallet,
  setActiveWallet,
  findUserByUsername,
  getActiveWallet,
  getTipById,
  getTipsByBatchId,
  getTipBatchById,
  getUserById,
  getUserByTgId,
  updateUserPreferences,
  createTipBatch,
  createTipQuote,
  claimTipForSend,
  claimTipBatchForSend,
  updateTipStatus,
  updateTipBatchStatus,
  recordGroupMessage,
  getGroupMessageAuthor,
  getRecentTipsForUser,
  getRecentSwapsForUser,
  type TgUser,
  type TgWallet,
  type TgTip,
} from "./users"
import { getBalance, getJettonBalance, getNetworkDisplay } from "@/lib/wallet/ton"
import { executeSwap, executeTipSwap, quoteTipSwap, resolveToken, TOKENS } from "@/lib/ston/swap"
import { Address, fromNano } from "@ton/core"

let _bot: Bot | null = null

function commandText(match: unknown) {
  if (typeof match === "string") return match.trim()
  if (Array.isArray(match)) return String(match[3] ?? "").trim()
  return ""
}

function commandArgs(match: unknown) {
  const text = commandText(match)
  return text ? text.split(/\s+/) : []
}

function normalizeUsername(username: string | null | undefined) {
  return username?.replace(/^@/, "").trim().toLowerCase() ?? ""
}

function isExpired(tip: Pick<TgTip, "expires_at">) {
  return new Date(tip.expires_at).getTime() <= Date.now()
}

function tokenList() {
  return Object.keys(TOKENS).join(", ")
}

function tipUsage() {
  return [
    "Usage:",
    "/tip <amount> <receive-token> @recipient",
    "/tip <amount> <receive-token> from <pay-token> @recipient",
    "examples:",
    "/tip 5 USDT @alice",
    "/tip 5 USDT from TON @alice",
    "/tip 50 USDT @devone @devtwo @devthree",
  ].join("\n")
}

function parseTipArgs(args: string[]) {
  if (args.length < 3) return null
  const [amount, ask] = args
  let offer = "TON"
  let recipients = args.slice(2)
  if (args[2]?.toLowerCase() === "from") {
    if (args.length < 5) return null
    offer = args[3]
    recipients = args.slice(4)
  }
  if (!recipients.length) return null
  const usernames = recipients.map((recipient) => {
    if (!recipient.startsWith("@")) return null
    const username = recipient.slice(1)
    return /^[A-Za-z0-9_]{5,32}$/.test(username) ? username : null
  })
  if (usernames.some((username) => !username)) return null
  const unique = [...new Set(usernames as string[])]
  if (unique.length !== usernames.length) return null
  return { amount, ask, offer, recipientUsernames: unique }
}

function parseSetTipArgs(args: string[]) {
  if (args.length !== 4 || args[2]?.toLowerCase() !== "from") return null
  return { amount: args[0], ask: args[1], offer: args[3] }
}

function sumDecimalStrings(values: string[]) {
  const scale = 1_000_000_000n
  let total = 0n
  for (const value of values) {
    const [whole, frac = ""] = value.split(".")
    total += BigInt(whole || "0") * scale + BigInt((frac + "0".repeat(9)).slice(0, 9))
  }
  const whole = total / scale
  const frac = (total % scale).toString().padStart(9, "0").slice(0, 4)
  return `${whole}.${frac}`
}

function tipButtonId(tip: TgTip) {
  return tip.batch_id ?? tip.id
}

function tipButtonPrefix(tip: TgTip) {
  return tip.batch_id ? "tipbatch" : "tip"
}

async function editOrReply(
  ctx: {
    editMessageText?: (text: string, options?: Record<string, unknown>) => Promise<unknown>
    reply: (text: string, options?: Record<string, unknown>) => Promise<unknown>
  },
  text: string,
  options?: Record<string, unknown>,
) {
  try {
    if (ctx.editMessageText) {
      await ctx.editMessageText(text, options)
      return
    }
  } catch (err) {
    console.warn("[tipswap] editMessageText failed, replying instead:", (err as Error).message)
  }
  await ctx.reply(text, options)
}

type TipQuoteRecipient = {
  user: TgUser
  wallet: TgWallet
  username: string
}

async function quoteAndStoreTips(params: {
  sender: TgUser
  senderWallet: TgWallet
  recipients: TipQuoteRecipient[]
  amount: string
  ask: string
  offer: string
  source: "command" | "reaction"
  sourceChatId?: number | null
  sourceMessageId?: number | null
}) {
  const quotes = []
  for (const recipient of params.recipients) {
    const quote = await quoteTipSwap({
      offer: params.offer,
      ask: params.ask,
      askAmount: params.amount,
      slippageBps: 100,
    })
    quotes.push({ recipient, quote })
  }

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const totalOffer = sumDecimalStrings(quotes.map(({ quote }) => quote.quotedOfferAmount))
  const batch =
    quotes.length > 1
      ? await createTipBatch({
          senderUserId: params.sender.id,
          source: params.source,
          offerToken: quotes[0].quote.offerSymbol,
          askToken: quotes[0].quote.askSymbol,
          askAmount: params.amount,
          recipientCount: quotes.length,
          quotedTotalOfferAmount: totalOffer,
          expiresAt,
        })
      : null

  const tips: TgTip[] = []
  for (const { recipient, quote } of quotes) {
    const tip = await createTipQuote({
      batchId: batch?.id ?? null,
      senderUserId: params.sender.id,
      recipientUserId: recipient.user.id,
      source: params.source,
      sourceChatId: params.sourceChatId ?? null,
      sourceMessageId: params.sourceMessageId ?? null,
      senderWalletId: params.senderWallet.id,
      recipientWalletId: recipient.wallet.id,
      recipientAddress: recipient.wallet.address,
      offerToken: quote.offerSymbol,
      askToken: quote.askSymbol,
      askAmount: params.amount,
      askRaw: quote.askRaw,
      quotedOfferAmount: quote.quotedOfferAmount,
      offerRaw: quote.offerRaw,
      expectedOut: quote.expectedOut,
      minAskAmount: quote.minAskAmount,
      slippageBps: quote.slippageBps,
      expiresAt,
    })
    tips.push(tip)
  }

  return { batch, tips, quotes, totalOffer, expiresAt }
}

function confirmationKeyboard(params: { id: string; prefix: "tip" | "tipbatch" }) {
  return new InlineKeyboard()
    .text("Confirm", `${params.prefix}:confirm:${params.id}`)
    .text("Cancel", `${params.prefix}:cancel:${params.id}`)
}

function tipConfirmText(params: {
  recipients: TipQuoteRecipient[]
  amount: string
  askSymbol: string
  offerSymbol: string
  totalOffer: string
  routerVersion: string
  source: "command" | "reaction"
}) {
  const recipientText =
    params.recipients.length === 1
      ? `Recipient: <b>@${params.recipients[0].user.tg_username ?? params.recipients[0].username}</b>`
      : `Recipients: <b>${params.recipients.length}</b>`
  const sourceLine = params.source === "reaction" ? "Source: reaction tip" : null
  return [
    "<b>🎁 Confirm tip</b>",
    "",
    recipientText,
    `Each receives: ≈ <b>${params.amount} ${params.askSymbol}</b>`,
    `You pay total: ≈ <b>${params.totalOffer} ${params.offerSymbol}</b>`,
    `Route: ${params.routerVersion === "direct" ? "direct TON transfer" : `STON.fi ${params.routerVersion}`}`,
    sourceLine,
    "",
    "Expires in 5 minutes.",
  ].filter(Boolean).join("\n")
}

async function executeClaimedTip(params: {
  tip: TgTip
  sender: TgUser
  senderWallet: TgWallet
  mnemonic: string
  api?: { sendMessage: (chatId: number, text: string, options?: Record<string, unknown>) => Promise<unknown> }
}) {
  const result = await executeTipSwap({
    mnemonic: params.mnemonic,
    senderAddress: params.senderWallet.address,
    recipientAddress: params.tip.recipient_address,
    offer: params.tip.offer_token,
    ask: params.tip.ask_token,
    askAmount: params.tip.ask_amount,
    slippageBps: params.tip.slippage_bps,
  })

  await updateTipStatus(params.tip.id, {
    status: result.sent ? "sent" : "failed",
    quotedOfferAmount: result.offerAmount,
    offerRaw: result.offerRaw,
    expectedOut: result.expectedOut,
    minAskAmount: result.minAskAmount,
    txHash: result.txHash,
    error: result.sent ? null : "Transaction did not confirm in time",
  })

  if (result.sent) {
    const recipient = await getUserById(params.tip.recipient_user_id)
    if (recipient && params.api) {
      try {
        await params.api.sendMessage(
          recipient.tg_id,
          [
            "<b>🎁 You received a tip!</b>",
            "",
            `≈ <b>${result.expectedOut} ${params.tip.ask_token}</b> from @${params.sender.tg_username ?? "a TipSwap user"}`,
            `Sent to: <code>${params.tip.recipient_address}</code>`,
          ].join("\n"),
          { parse_mode: "HTML" },
        )
      } catch (err) {
        console.warn("[tipswap] recipient notification failed:", err)
      }
    }
  }

  return result
}

async function cancelTip(tip: TgTip) {
  if (tip.status === "sent" || tip.status === "sending") return false
  if (tip.status !== "cancelled") {
    await updateTipStatus(tip.id, { status: "cancelled" })
  }
  return true
}

function finalBatchStatus(tips: TgTip[]) {
  if (tips.every((tip) => tip.status === "sent")) return "sent"
  if (tips.every((tip) => tip.status === "cancelled")) return "cancelled"
  if (tips.every((tip) => tip.status === "expired")) return "expired"
  return "failed"
}

export function getBot(): Bot {
  if (_bot) return _bot
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN
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
            "/connect  —  use your own TON wallet for balance tracking",
            "/managed  —  switch back to your TipSwap wallet",
            "/tip      —  send a token tip to another registered user",
            "/settings —  view tip defaults",
            "/help     —  full command list",
          ]
        : [
            `<b>👋 Welcome back, ${user.first_name ?? "friend"}!</b>`,
            "",
            `Active wallet (${wallet.mode}): <code>${wallet.address}</code>`,
            "",
            "Try /balance, /wallet, /connect, /managed, /swap, /tip, /settings, or /help.",
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
        "/connect &lt;address&gt;  —  use your own TON wallet for balance tracking",
        "/managed  —  switch back to your TipSwap managed wallet",
        "/swap &lt;amount&gt; &lt;from&gt; &lt;to&gt;  —  cross-token swap",
        "/tip &lt;amount&gt; &lt;receive-token&gt; @user  —  tip from TON",
        "/tip &lt;amount&gt; &lt;receive-token&gt; from &lt;pay-token&gt; @user  —  choose pay token",
        "/settip &lt;amount&gt; &lt;receive-token&gt; from &lt;pay-token&gt;  —  reaction default",
        "/receive &lt;token&gt;  —  set preferred receive token",
        "/settings —  show defaults",
        "/history  —  recent swaps and tips",
        "",
        "<b>Examples</b>",
        "<code>/swap 0.5 TON USDT</code>",
        "<code>/tip 5 USDT @alice</code>",
        "<code>/tip 5 USDT from TON @alice</code>",
        "<code>/tip 50 USDT @dev1 @dev2 @dev3</code>",
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
          `Mode: <b>${wallet.mode}</b>`,
          `<code>${wallet.address}</code>`,
          "",
          `💰 Balance: <b>${ton} TON</b>`,
          `📡 ${getNetworkDisplay()}`,
          `🎯 Receive as: ${user.default_recv_token}`,
          wallet.mode === "external"
            ? "Swaps from this wallet need wallet-side signing. Use /managed to swap with the bot."
            : "Use /connect &lt;address&gt; to track your own wallet instead.",
        ].join("\n"),
        { parse_mode: "HTML" },
      )
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      console.error("[tipswap] /wallet failed:", err)
      await ctx.reply(`Wallet lookup failed: ${msg}`)
    }
  })

  bot.command("connect", async (ctx) => {
    const tgUser = ctx.from
    if (!tgUser) return

    const addressInput = commandText(ctx.match)
    if (!addressInput) {
      await ctx.reply(
        "Usage: /connect <TON wallet address>\nexample: /connect UQ...",
      )
      return
    }

    let address: string
    try {
      address = Address.parse(addressInput).toString({
        bounceable: false,
        testOnly: false,
      })
    } catch {
      await ctx.reply("That does not look like a valid TON wallet address.")
      return
    }

    try {
      const { user } = await getOrCreateUser({
        tgId: tgUser.id,
        tgUsername: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
      })
      const wallet = await connectExternalWallet(user.id, address)
      const balance = await getBalance(wallet.address)

      await ctx.reply(
        [
          "<b>🔗 External wallet connected</b>",
          "",
          `<code>${wallet.address}</code>`,
          "",
          `💰 Balance: <b>${fromNano(balance)} TON</b>`,
          `📡 ${getNetworkDisplay()}`,
          "",
          "TipSwap will show balances for this wallet. Server-side swaps are only available from your managed wallet; use /managed to switch back.",
        ].join("\n"),
        { parse_mode: "HTML" },
      )
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      console.error("[tipswap] /connect failed:", err)
      await ctx.reply(`Wallet connect failed: ${msg}`)
    }
  })

  bot.command("managed", async (ctx) => {
    const tgUser = ctx.from
    if (!tgUser) return

    try {
      const { user } = await getOrCreateUser({
        tgId: tgUser.id,
        tgUsername: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
      })
      const wallet = await setActiveWallet(user.id, "managed")
      const balance = await getBalance(wallet.address)

      await ctx.reply(
        [
          "<b>✅ Managed wallet active</b>",
          "",
          `<code>${wallet.address}</code>`,
          "",
          `💰 Balance: <b>${fromNano(balance)} TON</b>`,
          `📡 ${getNetworkDisplay()}`,
          "",
          "You can now use /swap from this TipSwap-managed wallet.",
        ].join("\n"),
        { parse_mode: "HTML" },
      )
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      console.error("[tipswap] /managed failed:", err)
      await ctx.reply(`Could not activate managed wallet: ${msg}`)
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

  bot.command("receive", async (ctx) => {
    const tgUser = ctx.from
    if (!tgUser) return
    const [token] = commandArgs(ctx.match)
    if (!token) {
      await ctx.reply("Usage: /receive <token>\nexample: /receive USDT")
      return
    }
    try {
      const resolved = resolveToken(token)
      const { user } = await getOrCreateUser({
        tgId: tgUser.id,
        tgUsername: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
      })
      await updateUserPreferences(user.id, { defaultRecvToken: resolved.symbol })
      await ctx.reply(`Default receive token set to ${resolved.symbol}.`)
    } catch (err) {
      await ctx.reply(`${(err as Error).message}\nSupported: ${tokenList()}`)
    }
  })

  bot.command("settip", async (ctx) => {
    const tgUser = ctx.from
    if (!tgUser) return
    const parsed = parseSetTipArgs(commandArgs(ctx.match))
    if (!parsed || !/^\d+(\.\d+)?$/.test(parsed.amount)) {
      await ctx.reply("Usage: /settip <amount> <receive-token> from <pay-token>\nexample: /settip 1 USDT from TON")
      return
    }
    try {
      const ask = resolveToken(parsed.ask)
      const offer = resolveToken(parsed.offer)
      const { user } = await getOrCreateUser({
        tgId: tgUser.id,
        tgUsername: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
      })
      await updateUserPreferences(user.id, {
        reactionTipAmount: parsed.amount,
        reactionRecvToken: ask.symbol,
        reactionPayToken: offer.symbol,
      })
      await ctx.reply(
        `Reaction tip default set to ${parsed.amount} ${ask.symbol} from ${offer.symbol}.`,
      )
    } catch (err) {
      await ctx.reply(`${(err as Error).message}\nSupported: ${tokenList()}`)
    }
  })

  bot.command("settings", async (ctx) => {
    const tgUser = ctx.from
    if (!tgUser) return
    try {
      const { user, wallet } = await getOrCreateUser({
        tgId: tgUser.id,
        tgUsername: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
      })
      await ctx.reply(
        [
          "<b>⚙️ TipSwap Settings</b>",
          "",
          `Active wallet: <b>${wallet.mode}</b>`,
          `Receive token: <b>${user.default_recv_token}</b>`,
          `Reaction tip: <b>${user.reaction_tip_amount} ${user.reaction_recv_token}</b> from <b>${user.reaction_pay_token}</b>`,
          "",
          "<code>/receive USDT</code>",
          "<code>/settip 1 USDT from TON</code>",
        ].join("\n"),
        { parse_mode: "HTML" },
      )
    } catch (err) {
      await ctx.reply(`Settings lookup failed: ${(err as Error).message}`)
    }
  })

  bot.command("history", async (ctx) => {
    const tgUser = ctx.from
    if (!tgUser) return
    try {
      const { user } = await getOrCreateUser({
        tgId: tgUser.id,
        tgUsername: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
      })
      const [tips, swaps] = await Promise.all([
        getRecentTipsForUser(user.id, 8),
        getRecentSwapsForUser(user.id, 5),
      ])
      const lines = ["<b>🧾 Recent Activity</b>", ""]
      if (!tips.length && !swaps.length) {
        lines.push("No swaps or tips yet.")
      }
      if (tips.length) {
        lines.push("<b>Tips</b>")
        for (const tip of tips) {
          const direction = tip.sender_user_id === user.id ? "sent" : "received"
          lines.push(
            `${direction}: ${tip.ask_amount} ${tip.ask_token} ${tip.status}${tip.tx_hash ? ` (${tip.tx_hash.slice(0, 8)}…)` : ""}`,
          )
        }
      }
      if (swaps.length) {
        lines.push("", "<b>Swaps</b>")
        for (const swap of swaps) {
          lines.push(
            `${swap.offer_amount} ${swap.offer_token} → ${swap.ask_token} ${swap.status}${swap.tx_hash ? ` (${swap.tx_hash.slice(0, 8)}…)` : ""}`,
          )
        }
      }
      await ctx.reply(lines.join("\n"), { parse_mode: "HTML" })
    } catch (err) {
      await ctx.reply(`History lookup failed: ${(err as Error).message}`)
    }
  })

  bot.command("swap", async (ctx) => {
    const tgUser = ctx.from
    if (!tgUser) return

    const args = commandArgs(ctx.match)
    if (args.length !== 3 || args[0] === "") {
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

    if (wallet.mode !== "managed") {
      let managedWallet: TgWallet | null = null
      try {
        managedWallet = await getManagedWallet(user.id)
      } catch (err) {
        console.error("[tipswap] managed wallet lookup failed:", err)
      }
      await ctx.reply(
        [
          "Your active wallet is external, so TipSwap cannot sign this swap.",
          "",
          managedWallet
            ? `Use /managed to switch back to your TipSwap wallet:\n<code>${managedWallet.address}</code>`
            : "Use /start to create a managed wallet first.",
        ].join("\n"),
        { parse_mode: "HTML" },
      )
      return
    }

    try {
      const offerToken = resolveToken(offer)
      const askToken = resolveToken(ask)
      if (offerToken.symbol === askToken.symbol) {
        await ctx.reply("Offer and ask tokens must be different.")
        return
      }
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
        expectedOut: result.expectedOut,
        txHash: result.txHash,
        error: result.sent ? undefined : "Transaction did not confirm in time",
      })

      if (result.sent) {
        const txLink = `https://tonviewer.com/${wallet.address}`
        const lines = [
          `<b>✅ Swap complete!</b>`,
          "",
          `Swapped <b>${amountStr} ${offer.toUpperCase()}</b> → <b>${ask.toUpperCase()}</b>`,
        ]
        if (result.expectedOut) {
          lines.push(`≈ <b>${result.expectedOut}</b> ${ask.toUpperCase()} received`)
        }
        lines.push(
          `📡 ${getNetworkDisplay()}`,
          `🔢 Seqno: ${result.seqno}`,
          `🔗 <a href="${txLink}">View on tonviewer.com</a>`,
        )
        await ctx.reply(lines.join("\n"), { parse_mode: "HTML" })
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

  bot.command("tip", async (ctx) => {
    const tgUser = ctx.from
    if (!tgUser) return

    const parsed = parseTipArgs(commandArgs(ctx.match))
    if (!parsed) {
      await ctx.reply(tipUsage())
      return
    }

    if (!/^\d+(\.\d+)?$/.test(parsed.amount)) {
      await ctx.reply("Amount must be a number. Example: 5")
      return
    }

    let sender: TgUser
    let senderWallet: TgWallet
    try {
      const r = await getOrCreateUser({
        tgId: tgUser.id,
        tgUsername: tgUser.username ?? null,
        firstName: tgUser.first_name ?? null,
      })
      sender = r.user
      senderWallet = r.wallet
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      console.error("[tipswap] /tip sender lookup failed:", err)
      await ctx.reply(`Wallet lookup failed: ${msg}`)
      return
    }

    if (senderWallet.mode !== "managed") {
      let managedWallet: TgWallet | null = null
      try {
        managedWallet = await getManagedWallet(sender.id)
      } catch (err) {
        console.error("[tipswap] managed wallet lookup failed:", err)
      }
      await ctx.reply(
        [
          "Your active wallet is external, so TipSwap cannot sign this tip.",
          "",
          managedWallet
            ? `Use /managed to switch back to your TipSwap wallet:\n<code>${managedWallet.address}</code>`
            : "Use /start to create a managed wallet first.",
        ].join("\n"),
        { parse_mode: "HTML" },
      )
      return
    }

    try {
      resolveToken(parsed.offer)
      resolveToken(parsed.ask)
    } catch (err) {
      await ctx.reply(`${(err as Error).message}\nSupported: ${tokenList()}`)
      return
    }

    try {
      const recipients: TipQuoteRecipient[] = []
      for (const username of parsed.recipientUsernames) {
        if (
          normalizeUsername(tgUser.username) &&
          normalizeUsername(tgUser.username) === normalizeUsername(username)
        ) {
          await ctx.reply("You cannot tip yourself.")
          return
        }
        const recipient = await findUserByUsername(username)
        if (!recipient) {
          await ctx.reply(`@${username} needs to start TipSwap first with /start.`)
          return
        }
        if (recipient.id === sender.id || recipient.tg_id === tgUser.id) {
          await ctx.reply("You cannot tip yourself.")
          return
        }
        recipients.push({
          user: recipient,
          wallet: await getActiveWallet(recipient.id),
          username,
        })
      }

      const stored = await quoteAndStoreTips({
        sender,
        senderWallet,
        recipients,
        amount: parsed.amount,
        ask: parsed.ask,
        offer: parsed.offer,
        source: "command",
      })
      const firstQuote = stored.quotes[0].quote
      const id = stored.batch?.id ?? stored.tips[0].id
      const prefix = stored.batch ? "tipbatch" : "tip"

      await ctx.reply(
        tipConfirmText({
          recipients,
          amount: parsed.amount,
          askSymbol: firstQuote.askSymbol,
          offerSymbol: firstQuote.offerSymbol,
          totalOffer: stored.totalOffer,
          routerVersion: firstQuote.routerVersion,
          source: "command",
        }),
        {
          parse_mode: "HTML",
          reply_markup: confirmationKeyboard({ id, prefix }),
        },
      )
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      console.error("[tipswap] /tip failed:", err)
      await ctx.reply(`Tip quote failed: ${msg}`)
    }
  })

  bot.on("message", async (ctx, next) => {
    const msg = ctx.message
    const from = ctx.from
    if (
      msg &&
      from &&
      !from.is_bot &&
      msg.chat.type !== "private" &&
      typeof msg.message_id === "number"
    ) {
      try {
        const user = await getUserByTgId(from.id)
        if (!user) {
          await next()
          return
        }
        await recordGroupMessage({
          chatId: msg.chat.id,
          messageId: msg.message_id,
          authorUserId: user.id,
          authorTgId: from.id,
          authorUsername: from.username ?? null,
        })
      } catch (err) {
        console.warn("[tipswap] group message author record failed:", err)
      }
    }
    await next()
  })

  bot.reaction(["👍", "❤", "🔥", "🎉", "👏"], async (ctx) => {
    const reaction = ctx.messageReaction
    const tgUser = ctx.from
    if (!reaction || !tgUser) return

    try {
      const author = await getGroupMessageAuthor(
        reaction.chat.id,
        reaction.message_id,
      )
      if (!author) {
        await ctx.api.sendMessage(
          tgUser.id,
          "Reaction tipping is available only for messages I saw after being added to the group.",
        )
        return
      }
      if (author.author_tg_id === tgUser.id) return

      const sender = await getUserByTgId(tgUser.id)
      if (!sender) {
        await ctx.api.sendMessage(
          tgUser.id,
          "Start TipSwap first with /start, then react again to tip this message.",
        )
        return
      }
      const senderWallet = await getActiveWallet(sender.id)
      if (senderWallet.mode !== "managed") {
        await ctx.api.sendMessage(
          tgUser.id,
          "Your active wallet is external, so TipSwap cannot sign reaction tips. Use /managed first.",
        )
        return
      }

      const recipient = await getUserById(author.author_user_id)
      if (!recipient) return
      const recipientWallet = await getActiveWallet(recipient.id)

      const stored = await quoteAndStoreTips({
        sender,
        senderWallet,
        recipients: [{
          user: recipient,
          wallet: recipientWallet,
          username: recipient.tg_username ?? author.author_username ?? "recipient",
        }],
        amount: sender.reaction_tip_amount,
        ask: sender.reaction_recv_token,
        offer: sender.reaction_pay_token,
        source: "reaction",
        sourceChatId: reaction.chat.id,
        sourceMessageId: reaction.message_id,
      })
      const firstQuote = stored.quotes[0].quote
      const tip = stored.tips[0]

      await ctx.api.sendMessage(
        tgUser.id,
        tipConfirmText({
          recipients: [{
            user: recipient,
            wallet: recipientWallet,
            username: recipient.tg_username ?? author.author_username ?? "recipient",
          }],
          amount: sender.reaction_tip_amount,
          askSymbol: firstQuote.askSymbol,
          offerSymbol: firstQuote.offerSymbol,
          totalOffer: stored.totalOffer,
          routerVersion: firstQuote.routerVersion,
          source: "reaction",
        }),
        {
          parse_mode: "HTML",
          reply_markup: confirmationKeyboard({
            id: tipButtonId(tip),
            prefix: tipButtonPrefix(tip),
          }),
        },
      )
    } catch (err) {
      console.error("[tipswap] reaction tip failed:", err)
      await ctx.api.sendMessage(
        tgUser.id,
        `Reaction tip quote failed: ${(err as Error).message}`,
      ).catch(() => undefined)
    }
  })

  bot.callbackQuery(/^(tip|tipbatch):(confirm|cancel):([0-9a-f-]{36})$/, async (ctx) => {
    const tgUser = ctx.from
    if (!tgUser) return
    const match = Array.isArray(ctx.match) ? ctx.match : []
    const kind = String(match[1] ?? "")
    const action = String(match[2] ?? "")
    const id = String(match[3] ?? "")

    try {
      if (kind === "tipbatch") {
        const batch = await getTipBatchById(id)
        if (!batch) {
          await ctx.answerCallbackQuery({ text: "Tip batch not found.", show_alert: true })
          return
        }
        const sender = await getUserById(batch.sender_user_id)
        if (!sender || sender.tg_id !== tgUser.id) {
          await ctx.answerCallbackQuery({ text: "Only the sender can use this button.", show_alert: true })
          return
        }
        const tips = await getTipsByBatchId(batch.id)

        if (action === "cancel") {
          if (batch.status === "sent" || batch.status === "sending") {
            await ctx.answerCallbackQuery({ text: "This tip is already being processed.", show_alert: true })
            return
          }
          for (const tip of tips) await cancelTip(tip)
          await updateTipBatchStatus(batch.id, { status: "cancelled" })
          await ctx.answerCallbackQuery({ text: "Tip cancelled." })
          await editOrReply(ctx, "<b>Tip cancelled</b>\n\nNo funds were sent.", { parse_mode: "HTML" })
          return
        }

        if (batch.status === "sent") {
          await ctx.answerCallbackQuery({ text: "Tip already sent." })
          return
        }
        if (batch.status !== "quoted") {
          await ctx.answerCallbackQuery({ text: `Tip is already ${batch.status}.`, show_alert: true })
          return
        }
        if (isExpired(batch)) {
          for (const tip of tips) await updateTipStatus(tip.id, { status: "expired" })
          await updateTipBatchStatus(batch.id, { status: "expired" })
          await ctx.answerCallbackQuery({ text: "Tip quote expired.", show_alert: true })
          await editOrReply(ctx, "This tip quote expired. Send a new /tip command for a fresh quote.")
          return
        }

        const claimedBatch = await claimTipBatchForSend(batch.id)
        if (!claimedBatch) {
          const latest = await getTipBatchById(batch.id)
          await ctx.answerCallbackQuery({
            text: latest ? `Tip is already ${latest.status}.` : "Tip batch not found.",
            show_alert: true,
          })
          return
        }

        await ctx.answerCallbackQuery({ text: "Sending tips..." })
        await editOrReply(
          ctx,
          [
            "🔄 Sending tips...",
            "",
            `${tips.length} recipients, ${batch.ask_amount} ${batch.ask_token} each.`,
            "This can take a while because each recipient gets a separate transaction.",
          ].join("\n"),
          { parse_mode: "HTML" },
        )

        const senderWallet = await getManagedWallet(claimedBatch.sender_user_id)
        const mnemonic = await decryptMnemonic(senderWallet)
        for (const tip of tips) {
          const claimedTip = await claimTipForSend(tip.id)
          if (!claimedTip) continue
          try {
            await executeClaimedTip({
              tip: claimedTip,
              sender,
              senderWallet,
              mnemonic,
              api: ctx.api,
            })
          } catch (err) {
            const msg = (err as Error).message ?? String(err)
            await updateTipStatus(claimedTip.id, { status: "failed", error: msg.slice(0, 300) })
          }
        }

        const latestTips = await getTipsByBatchId(batch.id)
        const status = finalBatchStatus(latestTips)
        await updateTipBatchStatus(batch.id, { status, error: status === "failed" ? "One or more tips failed" : null })
        const sent = latestTips.filter((tip) => tip.status === "sent").length
        const failed = latestTips.filter((tip) => tip.status === "failed").length
        await editOrReply(
          ctx,
          [
            sent === latestTips.length ? "<b>✅ Tips sent!</b>" : "<b>⚠️ Tips processed</b>",
            "",
            `Sent: <b>${sent}</b>`,
            `Failed: <b>${failed}</b>`,
            `Recipients: <b>${latestTips.length}</b>`,
            `📡 ${getNetworkDisplay()}`,
          ].join("\n"),
          { parse_mode: "HTML" },
        )
        return
      }

      const tip = await getTipById(id)
      if (!tip) {
        await ctx.answerCallbackQuery({ text: "Tip quote not found.", show_alert: true })
        return
      }

      const sender = await getUserById(tip.sender_user_id)
      if (!sender || sender.tg_id !== tgUser.id) {
        await ctx.answerCallbackQuery({ text: "Only the sender can use this button.", show_alert: true })
        return
      }

      if (action === "cancel") {
        if (!(await cancelTip(tip))) {
          await ctx.answerCallbackQuery({ text: "This tip is already being processed.", show_alert: true })
          return
        }
        await ctx.answerCallbackQuery({ text: "Tip cancelled." })
        await editOrReply(
          ctx,
          [
            "<b>Tip cancelled</b>",
            "",
            `No ${tip.offer_token} was sent.`,
          ].join("\n"),
          { parse_mode: "HTML" },
        )
        return
      }

      if (tip.status === "sent") {
        await ctx.answerCallbackQuery({ text: "Tip already sent." })
        return
      }
      if (tip.status !== "quoted") {
        await ctx.answerCallbackQuery({
          text: `Tip is already ${tip.status}.`,
          show_alert: true,
        })
        return
      }
      if (isExpired(tip)) {
        await updateTipStatus(tip.id, { status: "expired" })
        await ctx.answerCallbackQuery({ text: "Tip quote expired.", show_alert: true })
        await editOrReply(
          ctx,
          "This tip quote expired. Send a new /tip command for a fresh quote.",
        )
        return
      }

      const claimed = await claimTipForSend(tip.id)
      if (!claimed) {
        const latest = await getTipById(tip.id)
        await ctx.answerCallbackQuery({
          text: latest ? `Tip is already ${latest.status}.` : "Tip quote not found.",
          show_alert: true,
        })
        return
      }

      await ctx.answerCallbackQuery({ text: "Sending tip..." })
      await editOrReply(
        ctx,
        [
          "🔄 Sending tip...",
          "",
          `Swapping ≈ <b>${claimed.quoted_offer_amount ?? "quoted"} ${claimed.offer_token}</b> → <b>${claimed.ask_amount} ${claimed.ask_token}</b>`,
          "This can take 10–30 seconds.",
        ].join("\n"),
        { parse_mode: "HTML" },
      )

      const senderWallet = await getManagedWallet(claimed.sender_user_id)
      const mnemonic = await decryptMnemonic(senderWallet)
      const result = await executeClaimedTip({
        tip: claimed,
        sender,
        mnemonic,
        senderWallet,
        api: ctx.api,
      })

      if (result.sent) {
        const txLink = `https://tonviewer.com/${senderWallet.address}`
        await editOrReply(
          ctx,
          [
            "<b>✅ Tip sent!</b>",
            "",
            `Recipient receives ≈ <b>${result.expectedOut} ${claimed.ask_token}</b>`,
            `You paid ≈ <b>${result.offerAmount} ${claimed.offer_token}</b>`,
            `📡 ${getNetworkDisplay()}`,
            `🔢 Seqno: ${result.seqno}`,
            `🔗 <a href="${txLink}">View on tonviewer.com</a>`,
          ].join("\n"),
          { parse_mode: "HTML" },
        )
      } else {
        await editOrReply(
          ctx,
          [
            "<b>⚠️ Tip transaction pending</b>",
            "",
            "The transaction was broadcast but has not confirmed yet.",
            "Check balances again shortly.",
          ].join("\n"),
          { parse_mode: "HTML" },
        )
      }
    } catch (err) {
      const msg = (err as Error).message ?? String(err)
      console.error("[tipswap] tip callback failed:", err)
      if (id) {
        await updateTipStatus(id, {
          status: "failed",
          error: msg.slice(0, 300),
        }).catch((updateErr) => {
          console.error("[tipswap] failed to update failed tip:", updateErr)
        })
      }
      await ctx.answerCallbackQuery({ text: "Tip failed.", show_alert: true }).catch(() => undefined)
      await editOrReply(ctx, `Tip failed: ${msg}`)
    }
  })

  bot.catch((err) => {
    console.error("[tipswap] bot.catch:", err)
  })

  _bot = bot
  return bot
}
