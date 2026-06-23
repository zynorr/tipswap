import "server-only"
import { adminClient } from "@/lib/supabase/admin"
import { encryptString, decryptString } from "@/lib/wallet/crypto"
import { generateNewWallet } from "@/lib/wallet/ton"

export type WalletMode = "managed" | "external"

export type TgUser = {
  id: string
  tg_id: number
  tg_username: string | null
  first_name: string | null
  default_recv_token: string
  reaction_tip_amount: string
  reaction_recv_token: string
  reaction_pay_token: string
}

export type TgWallet = {
  id: string
  user_id: string
  address: string
  public_key: string | null
  encrypted_mnemonic: string | null
  mode: WalletMode
  is_active: boolean
}

export type TipStatus =
  | "quoted"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled"
  | "expired"

export type TgTip = {
  id: string
  batch_id: string | null
  sender_user_id: string
  recipient_user_id: string
  source: "command" | "reaction"
  source_chat_id: number | null
  source_message_id: number | null
  sender_wallet_id: string | null
  recipient_wallet_id: string | null
  recipient_address: string
  offer_token: string
  ask_token: string
  ask_amount: string
  ask_raw: string
  quoted_offer_amount: string | null
  offer_raw: string | null
  expected_out: string | null
  min_ask_amount: string | null
  slippage_bps: number
  status: TipStatus
  tx_hash: string | null
  error: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

export type TgTipBatch = {
  id: string
  sender_user_id: string
  source: "command" | "reaction"
  offer_token: string
  ask_token: string
  ask_amount: string
  recipient_count: number
  quoted_total_offer_amount: string | null
  status: TipStatus
  error: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

export type TipClaimStatus =
  | "pending"
  | "quoting"
  | "quoted"
  | "failed"
  | "cancelled"
  | "expired"

export type TgTipClaim = {
  id: string
  code: string
  sender_user_id: string
  target_username: string
  offer_token: string
  ask_token: string
  ask_amount: string
  status: TipClaimStatus
  tip_id: string | null
  error: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

export type TgGroupMessage = {
  id: string
  chat_id: number
  message_id: number
  author_user_id: string
  author_tg_id: number
  author_username: string | null
  created_at: string
}

export type TgExternalTipPayment = {
  id: string
  tip_id: string
  sender_user_id: string
  recipient_user_id: string
  sender_address: string
  recipient_address: string
  provider: "tonpay" | "stonfi"
  asset: string
  amount: string
  reference: string | null
  body_base64_hash: string | null
  boc: string | null
  tx_hash: string | null
  trace_id: string | null
  status: "pending" | "submitted" | "sent" | "failed"
  error: string | null
  created_at: string
  updated_at: string
}

export type TgSwap = {
  id: string
  user_id: string
  offer_token: string
  ask_token: string
  offer_amount: string
  expected_out: string | null
  slippage_bps: number
  tx_hash: string | null
  status: string
  error: string | null
  created_at: string
  updated_at: string
}

/**
 * Find or create a Telegram user. If the user is new, also generates and stores
 * a managed TON wallet for them.
 */
export async function getOrCreateUser(input: {
  tgId: number
  tgUsername?: string | null
  firstName?: string | null
}): Promise<{ user: TgUser; wallet: TgWallet; created: boolean }> {
  const supabase = adminClient()

  async function waitForActiveWallet(userId: string) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: wallet, error: walletErr } = await supabase
        .from("tg_wallets")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle()

      if (walletErr) throw walletErr
      if (wallet) return wallet as unknown as TgWallet

      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)))
    }

    throw new Error("Your TipSwap wallet is still being created. Try again shortly.")
  }

  async function existingUserResult(user: TgUser) {
    let nextUser = user
    const profileUpdate: { tg_username?: string | null; first_name?: string | null } = {}
    if (input.tgUsername !== undefined && input.tgUsername !== user.tg_username) {
      profileUpdate.tg_username = input.tgUsername ?? null
    }
    if (input.firstName !== undefined && input.firstName !== user.first_name) {
      profileUpdate.first_name = input.firstName ?? null
    }
    if (Object.keys(profileUpdate).length) {
      const { data: updated, error: updateErr } = await supabase
        .from("tg_users")
        .update(profileUpdate)
        .eq("id", user.id as string)
        .select()
        .single()

      if (updateErr) throw updateErr
      nextUser = updated as unknown as TgUser
    }

    const wallet = await waitForActiveWallet(nextUser.id)
    return { user: nextUser, wallet, created: false }
  }

  // 1. Look up existing user
  const { data: existing, error: lookupErr } = await supabase
    .from("tg_users")
    .select("*")
    .eq("tg_id", input.tgId)
    .maybeSingle()

  if (lookupErr) throw lookupErr

  if (existing) {
    return existingUserResult(existing as unknown as TgUser)
  }

  // 2. Insert user
  const { data: user, error: insertErr } = await supabase
    .from("tg_users")
    .insert({
      tg_id: input.tgId,
      tg_username: input.tgUsername ?? null,
      first_name: input.firstName ?? null,
      reaction_tip_amount: "1",
      reaction_recv_token: "USDT",
      reaction_pay_token: "TON",
    })
    .select()
    .single()

  if (insertErr) {
    if (insertErr.code === "23505") {
      const { data: racedUser, error: racedLookupErr } = await supabase
        .from("tg_users")
        .select("*")
        .eq("tg_id", input.tgId)
        .single()

      if (racedLookupErr) throw racedLookupErr
      return existingUserResult(racedUser as unknown as TgUser)
    }
    throw insertErr
  }

  // 3. Generate managed wallet
  const generated = await generateNewWallet()
  const encrypted = encryptString(generated.mnemonic)

  const { data: wallet, error: walletErr } = await supabase
    .from("tg_wallets")
    .insert({
      user_id: user.id as string,
      address: generated.address,
      public_key: generated.publicKey,
      encrypted_mnemonic: encrypted,
      mode: "managed",
      is_active: true,
    })
    .select()
    .single()

  if (walletErr) throw walletErr

  return {
    user: user as unknown as TgUser,
    wallet: wallet as unknown as TgWallet,
    created: true,
  }
}

export async function decryptMnemonic(wallet: TgWallet) {
  if (wallet.mode !== "managed" || !wallet.encrypted_mnemonic) {
    throw new Error("Active wallet is external and cannot sign server-side swaps")
  }
  return decryptString(wallet.encrypted_mnemonic)
}

export async function findUserByUsername(usernameInput: string) {
  const username = usernameInput.replace(/^@/, "").trim()
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) return null
  const pattern = username.replace(/_/g, "\\_")

  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_users")
    .select("*")
    .ilike("tg_username", pattern)
    .maybeSingle()

  if (error) throw error
  return data as unknown as TgUser | null
}

export async function getUserById(id: string) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_users")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  return data as unknown as TgUser | null
}

export async function getUserByTgId(tgId: number) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_users")
    .select("*")
    .eq("tg_id", tgId)
    .maybeSingle()

  if (error) throw error
  return data as unknown as TgUser | null
}

export async function getActiveWallet(userId: string) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_wallets")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single()

  if (error) throw error
  return data as unknown as TgWallet
}

export async function updateUserPreferences(
  userId: string,
  patch: {
    defaultRecvToken?: string
    reactionTipAmount?: string
    reactionRecvToken?: string
    reactionPayToken?: string
  },
) {
  const update: {
    default_recv_token?: string
    reaction_tip_amount?: string
    reaction_recv_token?: string
    reaction_pay_token?: string
  } = {}
  if (patch.defaultRecvToken) update.default_recv_token = patch.defaultRecvToken
  if (patch.reactionTipAmount) update.reaction_tip_amount = patch.reactionTipAmount
  if (patch.reactionRecvToken) update.reaction_recv_token = patch.reactionRecvToken
  if (patch.reactionPayToken) update.reaction_pay_token = patch.reactionPayToken

  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_users")
    .update(update)
    .eq("id", userId)
    .select()
    .single()

  if (error) throw error
  return data as unknown as TgUser
}

export async function getManagedWallet(userId: string) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_wallets")
    .select("*")
    .eq("user_id", userId)
    .eq("mode", "managed")
    .single()

  if (error) throw error
  return data as unknown as TgWallet
}

export async function setActiveWallet(userId: string, mode: WalletMode) {
  const supabase = adminClient()

  const { data: wallet, error: lookupErr } = await supabase
    .from("tg_wallets")
    .select("*")
    .eq("user_id", userId)
    .eq("mode", mode)
    .single()

  if (lookupErr) throw lookupErr

  const { error: deactivateErr } = await supabase
    .from("tg_wallets")
    .update({ is_active: false })
    .eq("user_id", userId)
  if (deactivateErr) throw deactivateErr

  const { data: active, error: activateErr } = await supabase
    .from("tg_wallets")
    .update({ is_active: true })
    .eq("id", wallet.id as string)
    .select()
    .single()

  if (activateErr) throw activateErr
  return active as unknown as TgWallet
}

export async function connectExternalWallet(userId: string, address: string) {
  const supabase = adminClient()

  const { error: deactivateErr } = await supabase
    .from("tg_wallets")
    .update({ is_active: false })
    .eq("user_id", userId)
  if (deactivateErr) throw deactivateErr

  const { data, error } = await supabase
    .from("tg_wallets")
    .upsert(
      {
        user_id: userId,
        address,
        public_key: null,
        encrypted_mnemonic: null,
        mode: "external",
        is_active: true,
      },
      { onConflict: "user_id,mode" },
    )
    .select()
    .single()

  if (error) throw error
  return data as unknown as TgWallet
}

export async function logSwap(input: {
  userId: string
  offer: string
  ask: string
  offerAmount: string
  slippageBps: number
  status: "pending" | "sent" | "failed"
  expectedOut?: string | null
  txHash?: string
  error?: string
}) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_swaps")
    .insert({
      user_id: input.userId,
      offer_token: input.offer,
      ask_token: input.ask,
      offer_amount: input.offerAmount,
      expected_out: input.expectedOut ?? null,
      slippage_bps: input.slippageBps,
      status: input.status,
      tx_hash: input.txHash ?? null,
      error: input.error ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createTipBatch(input: {
  senderUserId: string
  source: "command" | "reaction"
  offerToken: string
  askToken: string
  askAmount: string
  recipientCount: number
  quotedTotalOfferAmount: string
  expiresAt?: string
}) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_tip_batches")
    .insert({
      sender_user_id: input.senderUserId,
      source: input.source,
      offer_token: input.offerToken,
      ask_token: input.askToken,
      ask_amount: input.askAmount,
      recipient_count: input.recipientCount,
      quoted_total_offer_amount: input.quotedTotalOfferAmount,
      status: "quoted",
      expires_at: input.expiresAt,
    })
    .select()
    .single()

  if (error) throw error
  return data as unknown as TgTipBatch
}

export async function createTipQuote(input: {
  batchId?: string | null
  senderUserId: string
  recipientUserId: string
  source?: "command" | "reaction"
  sourceChatId?: number | null
  sourceMessageId?: number | null
  senderWalletId: string
  recipientWalletId: string
  recipientAddress: string
  offerToken: string
  askToken: string
  askAmount: string
  askRaw: string
  quotedOfferAmount: string
  offerRaw: string
  expectedOut: string
  minAskAmount: string
  slippageBps: number
  expiresAt?: string
}) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_tips")
    .insert({
      batch_id: input.batchId ?? null,
      sender_user_id: input.senderUserId,
      recipient_user_id: input.recipientUserId,
      source: input.source ?? "command",
      source_chat_id: input.sourceChatId ?? null,
      source_message_id: input.sourceMessageId ?? null,
      sender_wallet_id: input.senderWalletId,
      recipient_wallet_id: input.recipientWalletId,
      recipient_address: input.recipientAddress,
      offer_token: input.offerToken,
      ask_token: input.askToken,
      ask_amount: input.askAmount,
      ask_raw: input.askRaw,
      quoted_offer_amount: input.quotedOfferAmount,
      offer_raw: input.offerRaw,
      expected_out: input.expectedOut,
      min_ask_amount: input.minAskAmount,
      slippage_bps: input.slippageBps,
      status: "quoted",
      expires_at: input.expiresAt,
    })
    .select()
    .single()

  if (error) throw error
  return data as unknown as TgTip
}

export async function createTipClaimInvite(input: {
  code: string
  senderUserId: string
  targetUsername: string
  offerToken: string
  askToken: string
  askAmount: string
  expiresAt?: string
}) {
  const targetUsername = input.targetUsername.replace(/^@/, "").trim().toLowerCase()
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_tip_claims")
    .insert({
      code: input.code,
      sender_user_id: input.senderUserId,
      target_username: targetUsername,
      offer_token: input.offerToken,
      ask_token: input.askToken,
      ask_amount: input.askAmount,
      status: "pending",
      expires_at: input.expiresAt,
    })
    .select()
    .single()

  if (error) throw error
  return data as unknown as TgTipClaim
}

export async function findPendingTipClaimInvite(input: {
  senderUserId: string
  targetUsername: string
  offerToken: string
  askToken: string
  askAmount: string
}) {
  const targetUsername = input.targetUsername.replace(/^@/, "").trim().toLowerCase()
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_tip_claims")
    .select("*")
    .eq("sender_user_id", input.senderUserId)
    .eq("target_username", targetUsername)
    .eq("offer_token", input.offerToken)
    .eq("ask_token", input.askToken)
    .eq("ask_amount", input.askAmount)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as unknown as TgTipClaim | null
}

export async function getTipClaimByCode(code: string) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_tip_claims")
    .select("*")
    .eq("code", code)
    .maybeSingle()

  if (error) throw error
  return data as unknown as TgTipClaim | null
}

export async function getRecentTipClaimsForUser(userId: string, limit = 8) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_tip_claims")
    .select("*")
    .eq("sender_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as unknown as TgTipClaim[]
}

export async function claimTipClaimForQuote(id: string) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_tip_claims")
    .update({ status: "quoting" })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .maybeSingle()

  if (error) throw error
  return data as unknown as TgTipClaim | null
}

export async function updateTipClaimStatus(
  id: string,
  patch: {
    status?: TipClaimStatus
    tipId?: string | null
    error?: string | null
  },
) {
  const update: {
    status?: TipClaimStatus
    tip_id?: string | null
    error?: string | null
  } = {}

  if ("status" in patch) update.status = patch.status
  if ("tipId" in patch) update.tip_id = patch.tipId ?? null
  if ("error" in patch) update.error = patch.error ?? null

  const supabase = adminClient()
  const { error } = await supabase
    .from("tg_tip_claims")
    .update(update)
    .eq("id", id)

  if (error) throw error
}

export async function getTipsByBatchId(batchId: string) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_tips")
    .select("*")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return data as unknown as TgTip[]
}

export async function getTipById(id: string) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_tips")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  return data as unknown as TgTip | null
}

export async function getTipBatchById(id: string) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_tip_batches")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error) throw error
  return data as unknown as TgTipBatch | null
}

export async function claimTipForSend(id: string) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_tips")
    .update({ status: "sending" })
    .eq("id", id)
    .eq("status", "quoted")
    .select()
    .maybeSingle()

  if (error) throw error
  return data as unknown as TgTip | null
}

export async function claimTipBatchForSend(id: string) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_tip_batches")
    .update({ status: "sending" })
    .eq("id", id)
    .eq("status", "quoted")
    .select()
    .maybeSingle()

  if (error) throw error
  return data as unknown as TgTipBatch | null
}

export async function updateTipBatchStatus(
  id: string,
  patch: {
    status: TipStatus
    quotedTotalOfferAmount?: string | null
    error?: string | null
  },
) {
  const update: {
    status: TipStatus
    quoted_total_offer_amount?: string | null
    error?: string | null
  } = { status: patch.status }
  if ("quotedTotalOfferAmount" in patch) update.quoted_total_offer_amount = patch.quotedTotalOfferAmount ?? null
  if ("error" in patch) update.error = patch.error ?? null

  const supabase = adminClient()
  const { error } = await supabase
    .from("tg_tip_batches")
    .update(update)
    .eq("id", id)

  if (error) throw error
}

export async function updateTipStatus(
  id: string,
  patch: {
    status: TipStatus
    quotedOfferAmount?: string | null
    offerRaw?: string | null
    expectedOut?: string | null
    minAskAmount?: string | null
    txHash?: string | null
    error?: string | null
  },
) {
  const supabase = adminClient()
  const update: {
    status: TipStatus
    quoted_offer_amount?: string | null
    offer_raw?: string | null
    expected_out?: string | null
    min_ask_amount?: string | null
    tx_hash?: string | null
    error?: string | null
  } = { status: patch.status }

  if ("quotedOfferAmount" in patch) update.quoted_offer_amount = patch.quotedOfferAmount ?? null
  if ("offerRaw" in patch) update.offer_raw = patch.offerRaw ?? null
  if ("expectedOut" in patch) update.expected_out = patch.expectedOut ?? null
  if ("minAskAmount" in patch) update.min_ask_amount = patch.minAskAmount ?? null
  if ("txHash" in patch) update.tx_hash = patch.txHash ?? null
  if ("error" in patch) update.error = patch.error ?? null

  const { error } = await supabase
    .from("tg_tips")
    .update(update)
    .eq("id", id)

  if (error) throw error
}

export async function createExternalTipPayment(input: {
  tipId: string
  senderUserId: string
  recipientUserId: string
  senderAddress: string
  recipientAddress: string
  provider: "tonpay" | "stonfi"
  asset: string
  amount: string
  reference?: string | null
  bodyBase64Hash?: string | null
}) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_external_tip_payments")
    .insert({
      tip_id: input.tipId,
      sender_user_id: input.senderUserId,
      recipient_user_id: input.recipientUserId,
      sender_address: input.senderAddress,
      recipient_address: input.recipientAddress,
      provider: input.provider,
      asset: input.asset,
      amount: input.amount,
      reference: input.reference ?? null,
      body_base64_hash: input.bodyBase64Hash ?? null,
      status: "pending",
    })
    .select()
    .single()

  if (error) throw error
  return data as unknown as TgExternalTipPayment
}

export async function getExternalTipPaymentByTipId(tipId: string) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_external_tip_payments")
    .select("*")
    .eq("tip_id", tipId)
    .maybeSingle()

  if (error) throw error
  return data as unknown as TgExternalTipPayment | null
}

export async function getExternalTipPaymentByReference(reference: string) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_external_tip_payments")
    .select("*")
    .eq("reference", reference)
    .maybeSingle()

  if (error) throw error
  return data as unknown as TgExternalTipPayment | null
}

export async function updateExternalTipPayment(
  id: string,
  patch: {
    status?: TgExternalTipPayment["status"]
    boc?: string | null
    txHash?: string | null
    traceId?: string | null
    error?: string | null
  },
) {
  const update: {
    status?: TgExternalTipPayment["status"]
    boc?: string | null
    tx_hash?: string | null
    trace_id?: string | null
    error?: string | null
  } = {}
  if ("status" in patch) update.status = patch.status
  if ("boc" in patch) update.boc = patch.boc ?? null
  if ("txHash" in patch) update.tx_hash = patch.txHash ?? null
  if ("traceId" in patch) update.trace_id = patch.traceId ?? null
  if ("error" in patch) update.error = patch.error ?? null

  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_external_tip_payments")
    .update(update)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data as unknown as TgExternalTipPayment
}

export async function updateSwapStatus(
  id: string,
  patch: {
    status: "sent" | "failed"
    expectedOut?: string | null
    txHash?: string
    error?: string
  },
) {
  const supabase = adminClient()
  const { error } = await supabase
    .from("tg_swaps")
    .update({
      status: patch.status,
      expected_out: patch.expectedOut ?? null,
      tx_hash: patch.txHash ?? null,
      error: patch.error ?? null,
    })
    .eq("id", id)
  if (error) throw error
}

export async function recordGroupMessage(input: {
  chatId: number
  messageId: number
  authorUserId: string
  authorTgId: number
  authorUsername?: string | null
}) {
  const supabase = adminClient()
  const { error } = await supabase
    .from("tg_group_messages")
    .upsert(
      {
        chat_id: input.chatId,
        message_id: input.messageId,
        author_user_id: input.authorUserId,
        author_tg_id: input.authorTgId,
        author_username: input.authorUsername ?? null,
      },
      { onConflict: "chat_id,message_id" },
    )

  if (error) throw error
}

export async function getGroupMessageAuthor(chatId: number, messageId: number) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_group_messages")
    .select("*")
    .eq("chat_id", chatId)
    .eq("message_id", messageId)
    .maybeSingle()

  if (error) throw error
  return data as unknown as TgGroupMessage | null
}

export async function getRecentTipsForUser(userId: string, limit = 8) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_tips")
    .select("*")
    .or(`sender_user_id.eq.${userId},recipient_user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as unknown as TgTip[]
}

export async function getExternalTipPaymentsByTipIds(tipIds: string[]) {
  if (!tipIds.length) return []
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_external_tip_payments")
    .select("*")
    .in("tip_id", tipIds)

  if (error) throw error
  return data as unknown as TgExternalTipPayment[]
}

export async function getRecentSwapsForUser(userId: string, limit = 5) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from("tg_swaps")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as unknown as TgSwap[]
}
