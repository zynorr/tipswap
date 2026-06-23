import "server-only"

import {
  createTonPayTransfer,
  getTonPayTransferByReference,
  TON,
  USDT,
  type CompletedTonPayTransferInfo,
} from "@ton-pay/api"
import { Address } from "@ton/core"
import {
  createExternalTipPayment,
  createTipQuote,
  findUserByUsername,
  findPendingTipClaimInvite,
  getActiveWallet,
  getExternalTipPaymentByReference,
  getExternalTipPaymentByTipId,
  getExternalTipPaymentsByTipIds,
  getTipById,
  getUserById,
  updateExternalTipPayment,
  updateTipStatus,
  type TgExternalTipPayment,
  type TgTip,
  type TgUser,
  type TgWallet,
} from "@/lib/bot/users"
import {
  claimSummary,
  createPendingTipClaim,
  normalizeUsername,
  resolveReceiveTokenForRecipient,
  tipSummary,
} from "@/lib/bot/tips"
import {
  buildExternalTipSwapTransaction,
  formatTokenAmount,
  quoteTipSwap,
  resolveToken,
  toRawAmount,
} from "@/lib/ston/swap"

type TonPayChain = "mainnet" | "testnet"

function tonPayChain(): TonPayChain {
  return process.env.TONPAY_CHAIN === "testnet" ? "testnet" : "mainnet"
}

function tonPayOptions() {
  return {
    chain: tonPayChain(),
    ...(process.env.TONPAY_API_KEY ? { apiKey: process.env.TONPAY_API_KEY } : {}),
  }
}

function assertAddress(address: string, label = "Wallet address") {
  if (!address.trim()) {
    throw new Error(`${label} is required.`)
  }

  try {
    return Address.parse(address).toString({ bounceable: false, testOnly: false })
  } catch {
    throw new Error(`${label} is not a valid TON address.`)
  }
}

function tonPayAsset(symbol: string, mainnetAddress: string) {
  if (symbol === "TON") return TON
  if (symbol === "USDT") return USDT
  return mainnetAddress
}

function asNumberAmount(amount: string) {
  const parsed = Number(amount)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Amount must be greater than zero.")
  }
  return parsed
}

function externalTipComment(tip: TgTip) {
  return `TipSwap tip ${tip.id.slice(0, 8)}`
}

function sameAddress(left: string, right: string) {
  return assertAddress(left) === assertAddress(right)
}

function validateTonPayTransfer(payment: TgExternalTipPayment, transfer: CompletedTonPayTransferInfo) {
  if (payment.provider !== "tonpay") return "Payment provider mismatch."
  if (!sameAddress(payment.sender_address, transfer.senderAddr)) return "Sender address mismatch."
  if (!sameAddress(payment.recipient_address, transfer.recipientAddr)) return "Recipient address mismatch."

  const token = resolveToken(payment.asset)
  const expectedRawAmount = toRawAmount(payment.amount, token.decimals).toString()
  if (transfer.rawAmount !== expectedRawAmount) return "Payment amount mismatch."

  const expectedAsset = tonPayAsset(token.symbol, token.mainnet)
  const tickerMatches = transfer.assetTicker?.toUpperCase() === payment.asset.toUpperCase()
  if (transfer.asset !== expectedAsset && !tickerMatches) return "Payment asset mismatch."

  return null
}

export async function prepareExternalTipPayment(params: {
  sender: TgUser
  senderWallet: TgWallet
  senderTelegramUsername?: string | null
  senderAddress: string
  recipientUsername: string
  amount: string
  ask: string
  offer: string
}) {
  if (!/^\d+(\.\d+)?$/.test(params.amount)) {
    throw new Error("Amount must be a number. Example: 5")
  }
  if (params.senderWallet.mode !== "external") {
    throw new Error("External payment mode requires an external active wallet.")
  }
  const senderAddress = assertAddress(params.senderAddress, "Connected wallet address")
  const activeAddress = assertAddress(params.senderWallet.address, "Active TipSwap wallet address")
  if (senderAddress !== activeAddress) {
    throw new Error("Connected TON wallet does not match your active TipSwap external wallet.")
  }

  const offer = resolveToken(params.offer)
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
    offerToken: offer.symbol,
    askToken: resolveReceiveTokenForRecipient(params.ask).symbol,
    askAmount: params.amount,
  })
  if (existingClaim) {
    return { type: "claim" as const, claim: existingClaim }
  }

  const recipientUser = await findUserByUsername(username)
  if (!recipientUser) {
    const ask = resolveReceiveTokenForRecipient(params.ask)
    const claim = await createPendingTipClaim({
      sender: params.sender,
      targetUsername: username,
      offerToken: offer.symbol,
      askToken: ask.symbol,
      askAmount: params.amount,
    })
    return { type: "claim" as const, claim }
  }
  if (recipientUser.id === params.sender.id) {
    throw new Error("You cannot tip yourself.")
  }

  const ask = resolveReceiveTokenForRecipient(params.ask, recipientUser)
  const recipientWallet = await getActiveWallet(recipientUser.id)
  const recipientAddress = assertAddress(recipientWallet.address, "Recipient wallet address")

  if (offer.symbol === ask.symbol) {
    const raw = toRawAmount(params.amount, ask.decimals)
    if (raw <= 0n) throw new Error("Amount must be greater than zero.")
    const formatted = formatTokenAmount(raw, ask.decimals)
    const tip = await createTipQuote({
      senderUserId: params.sender.id,
      recipientUserId: recipientUser.id,
      senderWalletId: params.senderWallet.id,
      recipientWalletId: recipientWallet.id,
      recipientAddress,
      offerToken: offer.symbol,
      askToken: ask.symbol,
      askAmount: params.amount,
      askRaw: raw.toString(),
      quotedOfferAmount: formatted,
      offerRaw: raw.toString(),
      expectedOut: formatted,
      minAskAmount: raw.toString(),
      slippageBps: 0,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })

    const transfer = await createTonPayTransfer(
      {
        amount: asNumberAmount(params.amount),
        asset: tonPayAsset(offer.symbol, offer.mainnet),
        recipientAddr: recipientAddress,
        senderAddr: senderAddress,
        commentToSender: externalTipComment(tip),
        commentToRecipient: externalTipComment(tip),
      },
      tonPayOptions(),
    )
    const payment = await createExternalTipPayment({
      tipId: tip.id,
      senderUserId: params.sender.id,
      recipientUserId: recipientUser.id,
      senderAddress,
      recipientAddress,
      provider: "tonpay",
      asset: offer.symbol,
      amount: formatted,
      reference: transfer.reference,
      bodyBase64Hash: transfer.bodyBase64Hash,
    })

    return {
      type: "external" as const,
      provider: "tonpay" as const,
      tip,
      payment,
      recipient: { user: recipientUser, wallet: recipientWallet, username },
      message: transfer.message,
      quote: {
        offerSymbol: offer.symbol,
        askSymbol: ask.symbol,
        quotedOfferAmount: formatted,
        expectedOut: formatted,
        routerVersion: "tonpay",
      },
    }
  }

  const quote = await quoteTipSwap({
    offer: offer.symbol,
    ask: ask.symbol,
    askAmount: params.amount,
    slippageBps: 100,
  })
  const tip = await createTipQuote({
    senderUserId: params.sender.id,
    recipientUserId: recipientUser.id,
    senderWalletId: params.senderWallet.id,
    recipientWalletId: recipientWallet.id,
    recipientAddress,
    offerToken: quote.offerSymbol,
    askToken: quote.askSymbol,
    askAmount: params.amount,
    askRaw: quote.askRaw,
    quotedOfferAmount: quote.quotedOfferAmount,
    offerRaw: quote.offerRaw,
    expectedOut: quote.expectedOut,
    minAskAmount: quote.minAskAmount,
    slippageBps: quote.slippageBps,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })
  const tx = await buildExternalTipSwapTransaction({
    senderAddress,
    recipientAddress,
    offer: offer.symbol,
    ask: ask.symbol,
    askAmount: params.amount,
    slippageBps: 100,
  })
  const payment = await createExternalTipPayment({
    tipId: tip.id,
    senderUserId: params.sender.id,
    recipientUserId: recipientUser.id,
    senderAddress,
    recipientAddress,
    provider: "stonfi",
    asset: offer.symbol,
    amount: quote.quotedOfferAmount,
  })

  return {
    type: "external" as const,
    provider: "stonfi" as const,
    tip,
    payment,
    recipient: { user: recipientUser, wallet: recipientWallet, username },
    message: tx.message,
    quote: {
      offerSymbol: quote.offerSymbol,
      askSymbol: quote.askSymbol,
      quotedOfferAmount: quote.quotedOfferAmount,
      expectedOut: quote.expectedOut,
      routerVersion: tx.routerVersion,
    },
  }
}

export async function prepareExternalPaymentForTip(params: {
  tip: TgTip
  sender: TgUser
  senderWallet: TgWallet
  senderAddress: string
}) {
  if (params.senderWallet.mode !== "external") {
    throw new Error("External payment mode requires an external active wallet.")
  }
  if (params.tip.sender_user_id !== params.sender.id) {
    throw new Error("Only the sender can sign this tip.")
  }
  if (params.tip.status !== "quoted") {
    throw new Error(`Tip is already ${params.tip.status}.`)
  }

  const senderAddress = assertAddress(params.senderAddress, "Connected wallet address")
  const activeAddress = assertAddress(params.senderWallet.address, "Active TipSwap wallet address")
  if (senderAddress !== activeAddress) {
    throw new Error("Connected TON wallet does not match your active TipSwap external wallet.")
  }

  const existingPayments = await getExternalTipPaymentsByTipIds([params.tip.id])
  const existingPayment = existingPayments[0]
  if (existingPayment && existingPayment.status !== "pending") {
    throw new Error(`External payment is already ${existingPayment.status}.`)
  }

  const offer = resolveToken(params.tip.offer_token)
  const ask = resolveToken(params.tip.ask_token)
  const recipientAddress = assertAddress(params.tip.recipient_address, "Recipient wallet address")

  if (offer.symbol === ask.symbol) {
    if (existingPayment && existingPayment.provider !== "tonpay") {
      throw new Error("This external payment was prepared for a different route.")
    }

    const raw = params.tip.offer_raw ? BigInt(params.tip.offer_raw) : toRawAmount(params.tip.ask_amount, ask.decimals)
    if (raw <= 0n) throw new Error("Amount must be greater than zero.")
    const formatted = formatTokenAmount(raw, ask.decimals)
    const transfer = await createTonPayTransfer(
      {
        amount: asNumberAmount(formatted),
        asset: tonPayAsset(offer.symbol, offer.mainnet),
        recipientAddr: recipientAddress,
        senderAddr: senderAddress,
        commentToSender: externalTipComment(params.tip),
        commentToRecipient: externalTipComment(params.tip),
      },
      tonPayOptions(),
    )
    const payment = existingPayment
      ? await updateExternalTipPayment(existingPayment.id, {
          status: "pending",
          boc: null,
          txHash: null,
          traceId: null,
          reference: transfer.reference,
          bodyBase64Hash: transfer.bodyBase64Hash,
          error: null,
        })
      : await createExternalTipPayment({
          tipId: params.tip.id,
          senderUserId: params.tip.sender_user_id,
          recipientUserId: params.tip.recipient_user_id,
          senderAddress,
          recipientAddress,
          provider: "tonpay",
          asset: offer.symbol,
          amount: formatted,
          reference: transfer.reference,
          bodyBase64Hash: transfer.bodyBase64Hash,
        })

    return {
      type: "external" as const,
      provider: "tonpay" as const,
      tip: params.tip,
      payment,
      message: transfer.message,
      quote: {
        offerSymbol: offer.symbol,
        askSymbol: ask.symbol,
        quotedOfferAmount: formatted,
        expectedOut: params.tip.expected_out ?? params.tip.ask_amount,
        routerVersion: "tonpay",
      },
    }
  }

  const tx = await buildExternalTipSwapTransaction({
    senderAddress,
    recipientAddress,
    offer: offer.symbol,
    ask: ask.symbol,
    askAmount: params.tip.ask_amount,
    slippageBps: params.tip.slippage_bps,
  })
  if (existingPayment && existingPayment.provider !== "stonfi") {
    throw new Error("This external payment was prepared for a different route.")
  }
  const payment = existingPayment
    ? await updateExternalTipPayment(existingPayment.id, {
        status: "pending",
        boc: null,
        txHash: null,
        traceId: null,
        reference: null,
        bodyBase64Hash: null,
        asset: offer.symbol,
        amount: tx.offerAmount,
        error: null,
      })
    : await createExternalTipPayment({
        tipId: params.tip.id,
        senderUserId: params.tip.sender_user_id,
        recipientUserId: params.tip.recipient_user_id,
        senderAddress,
        recipientAddress,
        provider: "stonfi",
        asset: offer.symbol,
        amount: tx.offerAmount,
      })

  return {
    type: "external" as const,
    provider: "stonfi" as const,
    tip: params.tip,
    payment,
    message: tx.message,
    quote: {
      offerSymbol: offer.symbol,
      askSymbol: ask.symbol,
      quotedOfferAmount: tx.offerAmount,
      expectedOut: tx.expectedOut,
      routerVersion: tx.routerVersion,
    },
  }
}

export async function markExternalTipPaymentSubmitted(params: {
  tipId: string
  telegramUserId: number
  boc: string
}) {
  const tip = await getTipById(params.tipId)
  if (!tip) throw new Error("Tip quote not found.")
  const sender = await getUserById(tip.sender_user_id)
  if (!sender || sender.tg_id !== params.telegramUserId) {
    throw new Error("Only the sender can submit this external payment.")
  }
  const payment = await getExternalTipPaymentByTipId(tip.id)
  if (!payment) throw new Error("External payment record not found.")
  const senderMatches = payment.sender_user_id === tip.sender_user_id
  if (!senderMatches) throw new Error("External payment sender mismatch.")
  if (tip.status !== "quoted") throw new Error(`Tip is already ${tip.status}.`)

  const updatedPayment = await updateExternalTipPayment(payment.id, {
    status: "submitted",
    boc: params.boc,
    error: null,
  })
  await updateTipStatus(tip.id, {
    status: "sending",
    error: null,
  })
  return { tip: (await getTipById(tip.id)) ?? tip, payment: updatedPayment }
}

export async function refreshTonPayTransfer(reference: string) {
  const payment = await getExternalTipPaymentByReference(reference)
  if (!payment) throw new Error("Payment reference not found.")
  const transfer = await getTonPayTransferByReference(reference, tonPayOptions())
  return applyTonPayTransferResult(payment, transfer)
}

export async function applyTonPayTransferResult(
  payment: TgExternalTipPayment,
  transfer: CompletedTonPayTransferInfo,
) {
  if (transfer.status === "pending") {
    return { payment, transfer, tip: await getTipById(payment.tip_id) }
  }

  const validationError = transfer.status === "success" ? validateTonPayTransfer(payment, transfer) : null
  const success = transfer.status === "success" && !validationError
  const updatedPayment = await updateExternalTipPayment(payment.id, {
    status: success ? "sent" : "failed",
    txHash: transfer.txHash,
    traceId: transfer.traceId,
    error: success ? null : validationError ?? transfer.errorMessage ?? "Payment failed",
  })
  const tipPatch = success
    ? { status: "sent" as const, txHash: transfer.txHash, error: null }
    : { status: "failed" as const, txHash: transfer.txHash, error: validationError ?? transfer.errorMessage ?? "Payment failed" }
  await updateTipStatus(payment.tip_id, tipPatch)

  return { payment: updatedPayment, transfer, tip: await getTipById(payment.tip_id) }
}

export function externalPaymentSummary(payment: TgExternalTipPayment) {
  return {
    id: payment.id,
    tipId: payment.tip_id,
    provider: payment.provider,
    status: payment.status,
    reference: payment.reference,
    txHash: payment.tx_hash,
    traceId: payment.trace_id,
    error: payment.error,
  }
}

export { claimSummary, tipSummary }
