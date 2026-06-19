/**
 * @file TON blockchain integration — client, wallet generation, balance queries, and transaction broadcasting.
 *
 * Architecture:
 *   - Uses TONCenter JSON-RPC as the blockchain endpoint (mainnet only)
 *   - Wallet generation produces 24-word mnemonics for WalletContractV4
 *   - Balance queries include exponential backoff for TONCenter 429 rate limits
 *   - Transaction broadcasting polls seqno to confirm the wallet processed the message
 *   - Jetton balance lookup uses two RPC calls: get_wallet_address (minter) → get_wallet_data (wallet)
 *
 * Rate-limit retry: 5 attempts with 2x backoff starting at 600ms.
 * Error mapping converts raw RPC errors into user-facing messages.
 */
import "server-only"
import { mnemonicNew, mnemonicToWalletKey } from "@ton/crypto"
import { WalletContractV4, TonClient, internal, SendMode } from "@ton/ton"
import { Address, beginCell, external, storeMessage, toNano, type Cell } from "@ton/core"

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

export async function getJettonWalletAddress(userAddress: string, jettonMinterAddress: string) {
  const client = getTonClient()
  try {
    const walletAddrResult = await withRateLimitRetry(() =>
      client.runMethod(
        Address.parse(jettonMinterAddress),
        "get_wallet_address",
        [{ type: "slice", cell: beginCell().storeAddress(Address.parse(userAddress)).endCell() }],
      ),
    )
    return walletAddrResult.stack.readAddress()
  } catch (err) {
    throw mapTonRpcError(err, "jetton wallet address fetch")
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

    const externalMessage = external({
      to: wallet.address,
      init: contract.init,
      body: transfer,
    })
    const txHash = beginCell()
      .store(storeMessage(externalMessage))
      .endCell()
      .hash()
      .toString("hex")

    await withRateLimitRetry(() => client.sendMessage(externalMessage))

    // Wait for seqno to advance. Keep this comfortably inside the Vercel Hobby
    // Fluid Compute window because Telegram webhooks run in one invocation.
    let attempts = 0
    while (attempts < 24) {
      await new Promise((r) => setTimeout(r, 2000))
      const newSeqno = await withRateLimitRetry(() => contract.getSeqno())
      if (newSeqno > seqno) {
        return { sent: true, seqno: newSeqno, txHash }
      }
      attempts++
    }

    return { sent: false, seqno, txHash }
  } catch (err) {
    throw mapTonRpcError(err, "swap transaction broadcast")
  }
}

export async function sendTonTransfer(params: {
  mnemonic: string
  to: string
  amount: bigint
}) {
  const buffer = 50_000_000n
  const balance = await getBalance((await deriveWalletFromMnemonic(params.mnemonic)).wallet.address.toString({ bounceable: false, testOnly: false }))
  if (balance < params.amount + buffer) {
    throw new Error(
      `Insufficient TON balance. Need ${fromNanoLike(params.amount + buffer)} TON including gas buffer, wallet has ${fromNanoLike(balance)} TON.`,
    )
  }

  return await sendInternalMessage({
    mnemonic: params.mnemonic,
    to: params.to,
    value: params.amount,
    bounce: false,
  })
}

export async function sendJettonTransfer(params: {
  mnemonic: string
  senderAddress: string
  jettonMinterAddress: string
  tokenSymbol?: string
  tokenDecimals?: number
  to: string
  amount: bigint
}) {
  const transferTon = toNano("0.08")
  const buffer = toNano("0.05")
  const [tonBalance, jettonBalance, jettonWalletAddress] = await Promise.all([
    getBalance(params.senderAddress),
    getJettonBalance(params.senderAddress, params.jettonMinterAddress),
    getJettonWalletAddress(params.senderAddress, params.jettonMinterAddress),
  ])

  if (tonBalance < transferTon + buffer) {
    throw new Error(
      `Insufficient TON balance. Need ${fromNanoLike(transferTon + buffer)} TON for jetton transfer gas, wallet has ${fromNanoLike(tonBalance)} TON.`,
    )
  }
  if (jettonBalance < params.amount) {
    const symbol = params.tokenSymbol ?? "token"
    const balance = params.tokenDecimals == null
      ? jettonBalance.toString()
      : formatUnits(jettonBalance, params.tokenDecimals)
    const needed = params.tokenDecimals == null
      ? params.amount.toString()
      : formatUnits(params.amount, params.tokenDecimals)
    throw new Error(`Insufficient ${symbol} balance. Need ${needed} ${symbol}, wallet has ${balance} ${symbol}.`)
  }

  const body = beginCell()
    .storeUint(0xf8a7ea5, 32)
    .storeUint(0, 64)
    .storeCoins(params.amount)
    .storeAddress(Address.parse(params.to))
    .storeAddress(Address.parse(params.senderAddress))
    .storeBit(0)
    .storeCoins(1n)
    .storeBit(0)
    .endCell()

  return await sendInternalMessage({
    mnemonic: params.mnemonic,
    to: jettonWalletAddress,
    value: transferTon,
    body,
    bounce: true,
  })
}

function fromNanoLike(amountNano: bigint) {
  const whole = amountNano / 1_000_000_000n
  const frac = (amountNano % 1_000_000_000n).toString().padStart(9, "0").slice(0, 4)
  return `${whole}.${frac}`
}

function formatUnits(amount: bigint, decimals: number) {
  const divisor = 10n ** BigInt(decimals)
  const whole = amount / divisor
  const frac = (amount % divisor).toString().padStart(decimals, "0").replace(/0+$/, "")
  return `${whole}${frac ? `.${frac}` : ""}`
}
