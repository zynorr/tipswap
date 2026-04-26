import "server-only"
import { adminClient } from "@/lib/supabase/admin"
import { encryptString, decryptString } from "@/lib/wallet/crypto"
import { generateNewWallet } from "@/lib/wallet/ton"

export type TgUser = {
  id: string
  tg_id: number
  tg_username: string | null
  first_name: string | null
  default_recv_token: string
}

export type TgWallet = {
  id: string
  user_id: string
  address: string
  public_key: string
  encrypted_mnemonic: string
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

  // 1. Look up existing user
  const { data: existing, error: lookupErr } = await supabase
    .from("tg_users")
    .select("*")
    .eq("tg_id", input.tgId)
    .maybeSingle()

  if (lookupErr) throw lookupErr

  if (existing) {
    const { data: wallet, error: wErr } = await supabase
      .from("tg_wallets")
      .select("*")
      .eq("user_id", existing.id as string)
      .single()

    if (wErr) throw wErr
    return { user: existing as unknown as TgUser, wallet: wallet as unknown as TgWallet, created: false }
  }

  // 2. Insert user
  const { data: user, error: insertErr } = await supabase
    .from("tg_users")
    .insert({
      tg_id: input.tgId,
      tg_username: input.tgUsername ?? null,
      first_name: input.firstName ?? null,
    })
    .select()
    .single()

  if (insertErr) throw insertErr

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
  return decryptString(wallet.encrypted_mnemonic)
}

export async function logSwap(input: {
  userId: string
  offer: string
  ask: string
  offerAmount: string
  slippageBps: number
  status: "pending" | "sent" | "failed"
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

export async function updateSwapStatus(
  id: string,
  patch: { status: "sent" | "failed"; txHash?: string; error?: string },
) {
  const supabase = adminClient()
  const { error } = await supabase
    .from("tg_swaps")
    .update({
      status: patch.status,
      tx_hash: patch.txHash ?? null,
      error: patch.error ?? null,
    })
    .eq("id", id)
  if (error) throw error
}
