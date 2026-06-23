import "server-only"

import { randomBytes } from "node:crypto"
import {
  claimTipClaimForQuote,
  claimTipForSend,
  createTipClaimInvite,
  createTipQuote,
  decryptMnemonic,
  findUserByUsername,
  findPendingTipClaimInvite,
  getActiveWallet,
  getManagedWallet,
  getTipById,
  getTipClaimByCode,
  getUserById,
  updateTipClaimStatus,
  updateTipStatus,
  type TgTip,
  type TgTipClaim,
  type TgUser,
  type TgWallet,
} from "@/lib/bot/users"
import { executeTipSwap, quoteTipSwap, resolveToken } from "@/lib/ston/swap"

export const CLAIM_INVITE_DAYS = 7
const CLAIM_START_PREFIX = "claim_"

export type TipQuoteRecipient = {
  user: TgUser
  wallet: TgWallet
  username: string
}

export type StoredSingleTipQuote = {
  tip: TgTip
  recipient: TipQuoteRecipient
  quote: Awaited<ReturnType<typeof quoteTipSwap>>
}

export function normalizeUsername(username: string | null | undefined) {
  return username?.replace(/^@/, "").trim().toLowerCase() ?? ""
}

export function isAutoReceiveToken(token: string | null | undefined) {
  const normalized = token?.trim().toUpperCase()
  return !normalized || normalized === "AUTO" || normalized === "PREFERENCE"
}

export function resolveReceiveTokenForRecipient(
  token: string | null | undefined,
  recipient?: Pick<TgUser, "default_recv_token"> | null,
) {
  return resolveToken(isAutoReceiveToken(token) ? recipient?.default_recv_token ?? "USDT" : token!)
}

export function isExpired(expiring: { expires_at: string }) {
  return new Date(expiring.expires_at).getTime() <= Date.now()
}

export function botUsername() {
  return (process.env.TELEGRAM_BOT_USERNAME ?? "tipswapbot").replace(/^@/, "")
}

export function newClaimCode() {
  return randomBytes(16).toString("base64url")
}

export function claimStartPayload(code: string) {
  return `${CLAIM_START_PREFIX}${code}`
}

export function claimLink(code: string) {
  return `https://t.me/${botUsername()}?start=${claimStartPayload(code)}`
}

export function miniAppClaimLink(code: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return claimLink(code)
  return `${appUrl.replace(/\/$/, "")}/miniapp?claim=${encodeURIComponent(code)}`
}

export function claimCodeFromStart(args: string[]) {
  return normalizeClaimCode(args[0] ?? "", { requireStartPrefix: true })
}

export function normalizeClaimCode(input: string | null | undefined, options: { requireStartPrefix?: boolean } = {}) {
  const raw = input?.trim() ?? ""
  if (!raw) return null

  let payload = raw
  try {
    const url = new URL(raw)
    payload =
      url.searchParams.get("claim") ??
      url.searchParams.get("start") ??
      url.searchParams.get("startapp") ??
      url.searchParams.get("tgWebAppStartParam") ??
      url.hash.replace(/^#/, "")
  } catch {
    // The input is not a URL; treat it as a direct code or start payload.
  }

  payload = decodeURIComponent(payload.trim())
  if (payload.startsWith(CLAIM_START_PREFIX)) {
    payload = payload.slice(CLAIM_START_PREFIX.length)
  } else if (options.requireStartPrefix) {
    return null
  }

  return /^[A-Za-z0-9_-]{8,128}$/.test(payload) ? payload : null
}

export function sumDecimalStrings(values: string[]) {
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

export async function createPendingTipClaim(params: {
  sender: TgUser
  targetUsername: string
  offerToken: string
  askToken: string
  askAmount: string
}) {
  const existing = await findPendingTipClaimInvite({
    senderUserId: params.sender.id,
    targetUsername: params.targetUsername,
    offerToken: params.offerToken,
    askToken: params.askToken,
    askAmount: params.askAmount,
  })
  if (existing) return existing

  return createTipClaimInvite({
    code: newClaimCode(),
    senderUserId: params.sender.id,
    targetUsername: params.targetUsername,
    offerToken: params.offerToken,
    askToken: params.askToken,
    askAmount: params.askAmount,
    expiresAt: new Date(Date.now() + CLAIM_INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  })
}

export async function quoteAndStoreSingleTip(params: {
  sender: TgUser
  senderWallet: TgWallet
  recipient: TipQuoteRecipient
  amount: string
  ask: string
  offer: string
  source?: "command" | "reaction"
}) {
  const quote = await quoteTipSwap({
    offer: params.offer,
    ask: params.ask,
    askAmount: params.amount,
    slippageBps: 100,
  })
  const tip = await createTipQuote({
    senderUserId: params.sender.id,
    recipientUserId: params.recipient.user.id,
    source: params.source ?? "command",
    senderWalletId: params.senderWallet.id,
    recipientWalletId: params.recipient.wallet.id,
    recipientAddress: params.recipient.wallet.address,
    offerToken: quote.offerSymbol,
    askToken: quote.askSymbol,
    askAmount: params.amount,
    askRaw: quote.askRaw,
    quotedOfferAmount: quote.quotedOfferAmount,
    offerRaw: quote.offerRaw,
    expectedOut: quote.expectedOut,
    minAskAmount: quote.minAskAmount,
    slippageBps: quote.slippageBps,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })

  return { tip, recipient: params.recipient, quote }
}

export async function prepareSingleRecipientTip(params: {
  sender: TgUser
  senderWallet: TgWallet
  senderTelegramUsername?: string | null
  recipientUsername: string
  amount: string
  ask: string
  offer: string
}) {
  if (!/^\d+(\.\d+)?$/.test(params.amount)) {
    throw new Error("Amount must be a number. Example: 5")
  }

  const offerToken = resolveToken(params.offer)
  const username = normalizeUsername(params.recipientUsername)
  if (!/^[a-z0-9_]{5,32}$/.test(username)) {
    throw new Error("Recipient username is invalid")
  }
  if (normalizeUsername(params.senderTelegramUsername) === username) {
    throw new Error("You cannot tip yourself.")
  }

  const existingClaim = await findPendingTipClaimInvite({
    senderUserId: params.sender.id,
    targetUsername: username,
    offerToken: offerToken.symbol,
    askToken: resolveReceiveTokenForRecipient(params.ask).symbol,
    askAmount: params.amount,
  })
  if (existingClaim) {
    return { type: "claim" as const, claim: existingClaim }
  }

  const recipientUser = await findUserByUsername(username)
  if (!recipientUser) {
    const askToken = resolveReceiveTokenForRecipient(params.ask)
    const claim = await createPendingTipClaim({
      sender: params.sender,
      targetUsername: username,
      offerToken: offerToken.symbol,
      askToken: askToken.symbol,
      askAmount: params.amount,
    })
    return { type: "claim" as const, claim }
  }
  if (recipientUser.id === params.sender.id) {
    throw new Error("You cannot tip yourself.")
  }

  const askToken = resolveReceiveTokenForRecipient(params.ask, recipientUser)
  const recipientWallet = await getActiveWallet(recipientUser.id)
  const stored = await quoteAndStoreSingleTip({
    sender: params.sender,
    senderWallet: params.senderWallet,
    recipient: { user: recipientUser, wallet: recipientWallet, username },
    amount: params.amount,
    ask: askToken.symbol,
    offer: offerToken.symbol,
  })
  return { type: "quote" as const, ...stored }
}

export async function prepareClaimForSenderConfirmation(params: {
  code: string
  recipient: TgUser
  recipientWallet: TgWallet
  recipientTelegramUsername?: string | null
}) {
  const code = normalizeClaimCode(params.code)
  if (!code) throw new Error("That tip claim link is not valid.")
  const claim = await getTipClaimByCode(code)
  if (!claim) throw new Error("That tip claim link is not valid.")
  if (isExpired(claim)) {
    await updateTipClaimStatus(claim.id, { status: "expired" })
    throw new Error("That tip claim link has expired. Ask the sender for a fresh /tip.")
  }

  const currentUsername = normalizeUsername(params.recipientTelegramUsername)
  if (!currentUsername || currentUsername !== normalizeUsername(claim.target_username)) {
    throw new Error(`This claim link is for @${claim.target_username}.`)
  }
  if (params.recipient.id === claim.sender_user_id) {
    await updateTipClaimStatus(claim.id, { status: "cancelled", error: "Sender claimed own invite" })
    throw new Error("You cannot claim your own tip invite.")
  }

  if (claim.status === "quoted" && claim.tip_id) {
    const existingTip = await getTipById(claim.tip_id)
    return { claim, tip: existingTip, alreadyPrepared: true as const }
  }
  if (claim.status !== "pending") {
    throw new Error(`This tip claim is already ${claim.status}.`)
  }

  const locked = await claimTipClaimForQuote(claim.id)
  if (!locked) throw new Error("This claim is already being prepared. Try again shortly.")

  let createdTip: TgTip | null = null
  try {
    const sender = await getUserById(claim.sender_user_id)
    if (!sender) throw new Error("Tip sender could not be found")
    const senderWallet = await getManagedWallet(sender.id)
    const prepared = await quoteAndStoreSingleTip({
      sender,
      senderWallet,
      recipient: {
        user: params.recipient,
        wallet: params.recipientWallet,
        username: claim.target_username,
      },
      amount: claim.ask_amount,
      ask: claim.ask_token,
      offer: claim.offer_token,
    })
    createdTip = prepared.tip
    await updateTipClaimStatus(claim.id, { status: "quoted", tipId: prepared.tip.id, error: null })
    return { claim, sender, senderWallet, ...prepared, alreadyPrepared: false as const }
  } catch (err) {
    if (createdTip) {
      await updateTipStatus(createdTip.id, {
        status: "cancelled",
        error: "Could not prepare claim confirmation",
      })
    }
    const msg = (err as Error).message ?? String(err)
    await updateTipClaimStatus(claim.id, { status: "failed", error: msg.slice(0, 300) })
    throw err
  }
}

export async function confirmSingleTip(params: {
  tipId: string
  telegramUserId: number
}) {
  const tip = await getTipById(params.tipId)
  if (!tip) throw new Error("Tip quote not found.")
  const sender = await getUserById(tip.sender_user_id)
  if (!sender || sender.tg_id !== params.telegramUserId) {
    throw new Error("Only the sender can confirm this tip.")
  }
  if (tip.status === "sent") return { tip, result: null, alreadySent: true as const }
  if (tip.status !== "quoted") throw new Error(`Tip is already ${tip.status}.`)
  if (isExpired(tip)) {
    await updateTipStatus(tip.id, { status: "expired" })
    throw new Error("This tip quote expired. Create a fresh quote.")
  }

  const claimed = await claimTipForSend(tip.id)
  if (!claimed) throw new Error("This tip is already being processed.")
  const senderWallet = await getManagedWallet(claimed.sender_user_id)
  const mnemonic = await decryptMnemonic(senderWallet)
  const result = await executeTipSwap({
    mnemonic,
    senderAddress: senderWallet.address,
    recipientAddress: claimed.recipient_address,
    offer: claimed.offer_token,
    ask: claimed.ask_token,
    askAmount: claimed.ask_amount,
    slippageBps: claimed.slippage_bps,
  })

  await updateTipStatus(claimed.id, {
    status: result.sent ? "sent" : "failed",
    quotedOfferAmount: result.offerAmount,
    offerRaw: result.offerRaw,
    expectedOut: result.expectedOut,
    minAskAmount: result.minAskAmount,
    txHash: result.txHash,
    error: result.sent ? null : "Transaction did not confirm in time",
  })

  return { tip: claimed, result, alreadySent: false as const }
}

export function tipSummary(tip: TgTip) {
  return {
    id: tip.id,
    status: tip.status,
    offerToken: tip.offer_token,
    askToken: tip.ask_token,
    askAmount: tip.ask_amount,
    quotedOfferAmount: tip.quoted_offer_amount,
    expectedOut: tip.expected_out,
    recipientAddress: tip.recipient_address,
    txHash: tip.tx_hash,
    expiresAt: tip.expires_at,
  }
}

export function claimSummary(claim: TgTipClaim) {
  return {
    id: claim.id,
    code: claim.code,
    status: claim.status,
    targetUsername: claim.target_username,
    offerToken: claim.offer_token,
    askToken: claim.ask_token,
    askAmount: claim.ask_amount,
    tipId: claim.tip_id,
    link: claimLink(claim.code),
    miniAppLink: miniAppClaimLink(claim.code),
    expiresAt: claim.expires_at,
    error: claim.error,
  }
}
