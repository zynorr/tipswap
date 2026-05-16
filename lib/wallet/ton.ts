import "server-only"
import { mnemonicNew, mnemonicToWalletKey } from "@ton/crypto"
import { WalletContractV4, TonClient, internal, SendMode } from "@ton/ton"
import { Address, beginCell, type Cell } from "@ton/core"

const ENDPOINTS = {
  mainnet: "https://toncenter.com/api/v2/jsonRPC",
} as const

export type TonNetwork = keyof typeof ENDPOINTS

export function getNetwork(): TonNetwork {
  return "mainnet"
}

export function getNetworkDisplay(): string {
  return "TON Mainnet"
}

function isRateLimitError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return message.includes("429") || message.toLowerCase().includes("too many requests")
}

function mapTonRpcError(err: unknown, context: string): Error {
  const message = err instanceof Error ? err.message : String(err)

  if (message.includes("status code 500")) {
    return new Error(
      `TON RPC internal error during ${context}. Retry in 20-30s; if it persists, verify TON_API_KEY is set in Vercel.`,
    )
  }
  if (message.includes("status code 403")) {
    return new Error(
      `TON RPC access denied during ${context}. Check TON_API_KEY and endpoint access.`,
    )
  }
  if (isRateLimitError(err)) {
    return new Error(
      `TON RPC rate limited during ${context}. Retry shortly and ensure TON_API_KEY is configured.`,
    )
  }
  return err instanceof Error ? err : new Error(message)
}

async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const retries = options.retries ?? 5
  const baseDelayMs = options.baseDelayMs ?? 600

  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err) {
      if (!isRateLimitError(err) || attempt >= retries) {
        throw err
      }
      const delay = baseDelayMs * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, delay))
      attempt++
    }
  }
}

export function getTonClient(network: TonNetwork = getNetwork()) {
  return new TonClient({
    endpoint: ENDPOINTS[network],
    apiKey: process.env.TON_API_KEY,
  })
}

export async function generateNewWallet() {
  const mnemonic = await mnemonicNew(24)
  const keypair = await mnemonicToWalletKey(mnemonic)
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keypair.publicKey,
  })
  return {
    mnemonic: mnemonic.join(" "),
    publicKey: keypair.publicKey.toString("hex"),
    address: wallet.address.toString({ bounceable: false, testOnly: false }),
  }
}

export async function deriveWalletFromMnemonic(mnemonic: string) {
  const words = mnemonic.trim().split(/\s+/)
  if (words.length !== 24) throw new Error("Invalid mnemonic")
  const keypair = await mnemonicToWalletKey(words)
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keypair.publicKey,
  })
  return { wallet, keypair }
}

export async function getBalance(address: string) {
  const client = getTonClient()
  try {
    const balance = await withRateLimitRetry(() =>
      client.getBalance(Address.parse(address)),
    )
    return balance // bigint, in nanotons
  } catch (err) {
    throw mapTonRpcError(err, "balance fetch")
  }
}

/**
 * Get the balance of a specific jetton for a given user address.
 * Queries the jetton minter for the user's jetton wallet address,
 * then reads the balance from that wallet.
 * Returns 0n if the jetton wallet doesn't exist (no balance).
 */
export async function getJettonBalance(userAddress: string, jettonMinterAddress: string) {
  const client = getTonClient()
  try {
    // 1. Get the jetton wallet address for this user from the minter
    const walletAddrResult = await withRateLimitRetry(() =>
      client.runMethod(
        Address.parse(jettonMinterAddress),
        "get_wallet_address",
        [{ type: "slice", cell: beginCell().storeAddress(Address.parse(userAddress)).endCell() }],
      ),
    )
    const jettonWalletAddress = walletAddrResult.stack.readAddress()

    // 2. Get wallet data (balance is first value in the tuple)
    const walletData = await withRateLimitRetry(() =>
      client.runMethod(jettonWalletAddress, "get_wallet_data", []),
    )
    return walletData.stack.readBigNumber() // bigint, in raw token units
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // If the contract doesn't exist (exit code -1 or contract not found), balance is 0
    if (
      message.toLowerCase().includes("contract not initialized") ||
      message.toLowerCase().includes("exit code") ||
      message.toLowerCase().includes("unable to execute") ||
      message.toLowerCase().includes("account not found")
    ) {
      return 0n
    }
    throw mapTonRpcError(err, "jetton balance fetch")
  }
}

/**
 * Send an arbitrary message body (e.g. a STON.fi swap message) to a target contract.
 * Returns the hash of the external message we broadcast.
 */
export async function sendInternalMessage(params: {
  mnemonic: string
  to: Address | string
  value: bigint
  body?: Cell
  bounce?: boolean
}) {
  try {
    const { wallet, keypair } = await deriveWalletFromMnemonic(params.mnemonic)
    const client = getTonClient()
    const contract = client.open(wallet)

    const seqno = await withRateLimitRetry(() => contract.getSeqno())

    const transfer = await contract.createTransfer({
      secretKey: keypair.secretKey,
      seqno,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      messages: [
        internal({
          to: typeof params.to === "string" ? Address.parse(params.to) : params.to,
          value: params.value,
          body: params.body,
          bounce: params.bounce ?? false,
        }),
      ],
    })

    await withRateLimitRetry(() => contract.send(transfer))

    // Wait for seqno to advance — that confirms the wallet processed the tx
    let attempts = 0
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000))
      const newSeqno = await withRateLimitRetry(() => contract.getSeqno())
      if (newSeqno > seqno) {
        return { sent: true, seqno: newSeqno }
      }
      attempts++
    }

    return { sent: false, seqno }
  } catch (err) {
    throw mapTonRpcError(err, "swap transaction broadcast")
  }
}
