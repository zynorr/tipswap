import "server-only"
import { mnemonicNew, mnemonicToWalletKey } from "@ton/crypto"
import { WalletContractV4, TonClient, internal, SendMode } from "@ton/ton"
import { Address, type Cell } from "@ton/core"

const ENDPOINTS = {
  mainnet: "https://toncenter.com/api/v2/jsonRPC",
  testnet: "https://testnet.toncenter.com/api/v2/jsonRPC",
} as const

export type TonNetwork = keyof typeof ENDPOINTS

export function getNetwork(): TonNetwork {
  // Default to mainnet for production safety. STON.fi only has liquidity on mainnet,
  // so testnet is opt-in for development only.
  const v = (process.env.STON_NETWORK ?? "mainnet").toLowerCase()
  return v === "testnet" ? "testnet" : "mainnet"
}

/**
 * Format an address as a user-friendly string for the active network.
 * On mainnet we use the non-bounceable UQ-prefix form, which is what
 * Tonkeeper / Tonhub display and what users paste when topping up wallets.
 */
export function formatAddress(addr: string | Address, network: TonNetwork = getNetwork()) {
  const a = typeof addr === "string" ? Address.parse(addr) : addr
  return a.toString({ bounceable: false, testOnly: network === "testnet" })
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
    address: formatAddress(wallet.address),
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
  const balance = await client.getBalance(Address.parse(address))
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

  const seqno = await contract.getSeqno()

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

  await contract.send(transfer)

  // Wait for seqno to advance — that confirms the wallet processed the tx
  let attempts = 0
  while (attempts < 30) {
    await new Promise((r) => setTimeout(r, 2000))
    const newSeqno = await contract.getSeqno()
    if (newSeqno > seqno) {
      return { sent: true, seqno: newSeqno }
    }
    attempts++
  }

  return { sent: false, seqno }
}
