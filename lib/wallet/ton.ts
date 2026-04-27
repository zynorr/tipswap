import "server-only"
import { mnemonicNew, mnemonicToWalletKey } from "@ton/crypto"
import { WalletContractV4, TonClient, internal, SendMode } from "@ton/ton"
import { Address, type Cell } from "@ton/core"

const ENDPOINTS = {
  mainnet: "https://toncenter.com/api/v2/jsonRPC",
} as const

export type TonNetwork = keyof typeof ENDPOINTS

export function getNetwork(): TonNetwork {
  return "mainnet"
}

function isRateLimitError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return message.includes("429") || message.toLowerCase().includes("too many requests")
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
  const balance = await withRateLimitRetry(() =>
    client.getBalance(Address.parse(address)),
  )
  return balance // bigint, in nanotons
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
}
