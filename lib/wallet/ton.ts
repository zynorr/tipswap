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
import { Address, beginCell, Cell, external, loadMessage, storeMessage, toNano, type Cell as TonCell, type Message } from "@ton/core"

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

function transactionSucceeded(tx: Awaited<ReturnType<TonClient["getTransactions"]>>[number]) {
  const description = tx.description
  if (
    description.type === "generic" ||
    description.type === "tick-tock" ||
    description.type === "split-prepare" ||
    description.type === "merge-install"
  ) {
    const computeOk =
      description.computePhase.type === "vm"
        ? description.computePhase.success && description.computePhase.exitCode === 0
        : false
    const actionOk = description.actionPhase ? description.actionPhase.success : true
    return computeOk && actionOk && !description.aborted
  }
  return false
}

function transactionFailureReason(tx: Awaited<ReturnType<TonClient["getTransactions"]>>[number]) {
  const description = tx.description
  if (
    description.type === "generic" ||
    description.type === "tick-tock" ||
    description.type === "split-prepare" ||
    description.type === "merge-install"
  ) {
    if (description.aborted) return "Wallet transaction aborted."
    if (description.computePhase.type === "skipped") {
      return `Wallet transaction compute skipped: ${description.computePhase.reason}.`
    }
    if (!description.computePhase.success || description.computePhase.exitCode !== 0) {
      return `Wallet transaction failed with exit code ${description.computePhase.exitCode}.`
    }
    if (description.actionPhase && !description.actionPhase.success) {
      return `Wallet action phase failed with result code ${description.actionPhase.resultCode}.`
    }
  }
  return "Wallet transaction failed."
}

function signedBocHashCandidates(boc: string) {
  const normalized = boc.trim()
  const cells = Cell.fromBoc(Buffer.from(normalized, "base64"))
  if (!cells.length) throw new Error("Signed transaction BOC is invalid.")
  const root = cells[0]
  const candidates = new Set<string>([
    root.hash().toString("hex"),
    root.hash().toString("base64"),
  ])
  try {
    const message = loadMessage(root.beginParse())
    candidates.add(message.body.hash().toString("hex"))
    candidates.add(message.body.hash().toString("base64"))
  } catch {
    // Some wallets return only the external message body, not the full message.
  }
  candidates.delete("")
  return { root, candidates }
}

function messageMatchesBoc(
  message: Message,
  candidates: Set<string>,
) {
  const messageHash = beginCell().store(storeMessage(message)).endCell().hash()
  return (
    candidates.has(message.body.hash().toString("hex")) ||
    candidates.has(message.body.hash().toString("base64")) ||
    candidates.has(messageHash.toString("hex")) ||
    candidates.has(messageHash.toString("base64"))
  )
}

export async function inspectSignedExternalMessage(params: {
  senderAddress: string
  boc: string
  limit?: number
}) {
  const client = getTonClient()
  try {
    const { root, candidates } = signedBocHashCandidates(params.boc)
    candidates.add(root.hash().toString("hex"))
    candidates.add(root.hash().toString("base64"))

    const txs = await withRateLimitRetry(() =>
      client.getTransactions(Address.parse(params.senderAddress), {
        limit: params.limit ?? 20,
        archival: false,
      }),
    )

    const matched = txs.find((tx) => {
      const inMessage = tx.inMessage
      if (!inMessage || inMessage.info.type !== "external-in") return false
      return messageMatchesBoc(inMessage, candidates)
    })

    if (!matched) {
      return {
        status: "pending" as const,
        txHash: null,
        error: null,
      }
    }

    const txHash = matched.hash().toString("hex")
    if (transactionSucceeded(matched)) {
      return {
        status: "success" as const,
        txHash,
        error: null,
      }
    }

    return {
      status: "failed" as const,
      txHash,
      error: transactionFailureReason(matched),
    }
  } catch (err) {
    throw mapTonRpcError(err, "signed transaction lookup")
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
  body?: TonCell
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
