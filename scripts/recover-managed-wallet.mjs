#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
import { createDecipheriv, scryptSync } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { mnemonicToWalletKey } from "@ton/crypto"
import { Address, beginCell, external, internal, storeMessage, toNano } from "@ton/core"
import { SendMode, TonClient, WalletContractV4 } from "@ton/ton"

const TOKENS = {
  TON: { decimals: 9 },
  USDT: {
    decimals: 6,
    minter: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
    transferTon: toNano("0.08"),
  },
  STON: {
    decimals: 9,
    minter: "EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmwG9T6bO",
    transferTon: toNano("0.08"),
  },
}

const DEFAULT_FROM = "craxe21"
const DEFAULT_TO = "maadg11"
const DEFAULT_TON_RESERVE = toNano("0.08")
const ENDPOINT = "https://toncenter.com/api/v2/jsonRPC"

function loadEnvFile(path) {
  if (!existsSync(path)) return
  const text = readFileSync(path, "utf8")
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue
    const index = trimmed.indexOf("=")
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] ??= value
  }
}

function parseArgs(argv) {
  const args = {
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
    tokens: Object.keys(TOKENS),
    execute: false,
    tonReserve: DEFAULT_TON_RESERVE,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--execute") args.execute = true
    else if (arg === "--from") args.from = argv[++i]
    else if (arg === "--to") args.to = argv[++i]
    else if (arg === "--tokens") args.tokens = argv[++i].split(",").map((token) => token.trim().toUpperCase())
    else if (arg === "--ton-reserve") args.tonReserve = toNano(argv[++i])
    else if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  args.from = cleanUsername(args.from)
  args.to = cleanUsername(args.to)
  for (const token of args.tokens) {
    if (!TOKENS[token]) throw new Error(`Unsupported token: ${token}. Use ${Object.keys(TOKENS).join(", ")}`)
  }
  return args
}

function printHelp() {
  console.log(`Recover funds from one TipSwap managed wallet to another.

Default is dry-run. Add --execute to broadcast transactions.

Usage:
  node scripts/recover-managed-wallet.mjs
  node scripts/recover-managed-wallet.mjs --execute
  node scripts/recover-managed-wallet.mjs --from craxe21 --to maadg11 --tokens TON,USDT,STON --ton-reserve 0.08 --execute
`)
}

function cleanUsername(username) {
  return username.replace(/^@/, "").trim()
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

function decryptString(payload) {
  const parts = payload.split(":")
  if (parts.length !== 4) throw new Error("Malformed encrypted mnemonic payload")
  const [saltHex, ivHex, tagHex, ctHex] = parts
  const salt = Buffer.from(saltHex, "hex")
  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  const ciphertext = Buffer.from(ctHex, "hex")
  const key = scryptSync(requireEnv("WALLET_ENCRYPTION_KEY"), salt, 32)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!url) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is not set")
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is not set")
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function findUserByUsername(supabase, username) {
  const { data, error } = await supabase
    .from("tg_users")
    .select("*")
    .ilike("tg_username", username.replace(/_/g, "\\_"))
    .maybeSingle()
  if (error) throw error
  return data
}

async function getManagedWallet(supabase, userId) {
  const { data, error } = await supabase
    .from("tg_wallets")
    .select("*")
    .eq("user_id", userId)
    .eq("mode", "managed")
    .single()
  if (error) throw error
  return data
}

async function getActiveWallet(supabase, userId) {
  const { data, error } = await supabase
    .from("tg_wallets")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single()
  if (error) throw error
  return data
}

async function deriveWalletFromMnemonic(mnemonic) {
  const words = mnemonic.trim().split(/\s+/)
  if (words.length !== 24) throw new Error("Invalid source wallet mnemonic")
  const keypair = await mnemonicToWalletKey(words)
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keypair.publicKey })
  return { wallet, keypair }
}

function formatToken(raw, decimals) {
  const sign = raw < 0n ? "-" : ""
  const abs = raw < 0n ? -raw : raw
  const divisor = 10n ** BigInt(decimals)
  const whole = abs / divisor
  const frac = (abs % divisor).toString().padStart(decimals, "0").replace(/0+$/, "")
  return `${sign}${whole.toString()}${frac ? `.${frac}` : ""}`
}

async function getJettonWalletAddress(client, ownerAddress, minterAddress) {
  const result = await client.runMethod(Address.parse(minterAddress), "get_wallet_address", [
    { type: "slice", cell: beginCell().storeAddress(Address.parse(ownerAddress)).endCell() },
  ])
  return result.stack.readAddress()
}

async function getJettonBalance(client, ownerAddress, minterAddress) {
  try {
    const jettonWalletAddress = await getJettonWalletAddress(client, ownerAddress, minterAddress)
    const data = await client.runMethod(jettonWalletAddress, "get_wallet_data", [])
    return { jettonWalletAddress, balance: data.stack.readBigNumber() }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (
      message.toLowerCase().includes("contract not initialized") ||
      message.toLowerCase().includes("account not found") ||
      message.toLowerCase().includes("exit code") ||
      message.toLowerCase().includes("unable to execute")
    ) {
      return { jettonWalletAddress: null, balance: 0n }
    }
    throw err
  }
}

function jettonTransferBody({ amount, destination, responseDestination }) {
  return beginCell()
    .storeUint(0xf8a7ea5, 32)
    .storeUint(0, 64)
    .storeCoins(amount)
    .storeAddress(Address.parse(destination))
    .storeAddress(Address.parse(responseDestination))
    .storeBit(0)
    .storeCoins(1n)
    .storeBit(0)
    .endCell()
}

async function sendMessages({ client, wallet, keypair, messages }) {
  const contract = client.open(wallet)
  const seqno = await contract.getSeqno()
  const transfer = await contract.createTransfer({
    secretKey: keypair.secretKey,
    seqno,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages,
  })

  const externalMessage = external({
    to: wallet.address,
    init: contract.init,
    body: transfer,
  })
  const txHash = beginCell().store(storeMessage(externalMessage)).endCell().hash().toString("hex")
  await client.sendMessage(externalMessage)

  for (let attempt = 0; attempt < 24; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const nextSeqno = await contract.getSeqno()
    if (nextSeqno > seqno) return { sent: true, txHash, seqno: nextSeqno }
  }
  return { sent: false, txHash, seqno }
}

async function main() {
  loadEnvFile(".env.local")
  const args = parseArgs(process.argv.slice(2))
  const supabase = createSupabaseAdmin()
  const client = new TonClient({ endpoint: ENDPOINT, apiKey: process.env.TON_API_KEY })

  const [fromUser, toUser] = await Promise.all([
    findUserByUsername(supabase, args.from),
    findUserByUsername(supabase, args.to),
  ])
  if (!fromUser) throw new Error(`Source user @${args.from} was not found in tg_users`)
  if (!toUser) throw new Error(`Destination user @${args.to} was not found in tg_users`)

  const [fromWallet, toWallet] = await Promise.all([
    getManagedWallet(supabase, fromUser.id),
    getActiveWallet(supabase, toUser.id),
  ])
  if (!fromWallet.encrypted_mnemonic) throw new Error(`Source @${args.from} managed wallet has no mnemonic`)

  const mnemonic = decryptString(fromWallet.encrypted_mnemonic)
  const { wallet, keypair } = await deriveWalletFromMnemonic(mnemonic)
  const derivedAddress = wallet.address.toString({ bounceable: false, testOnly: false })
  if (derivedAddress !== fromWallet.address) {
    throw new Error(`Derived source wallet ${derivedAddress} does not match database wallet ${fromWallet.address}`)
  }

  console.log(`Source: @${args.from} ${fromWallet.address}`)
  console.log(`Target: @${args.to} ${toWallet.address} (${toWallet.mode})`)
  console.log(`Mode: ${args.execute ? "EXECUTE" : "DRY RUN"}`)
  console.log("")

  const messages = []
  const tonBalance = await client.getBalance(Address.parse(fromWallet.address))
  console.log(`TON balance: ${formatToken(tonBalance, TOKENS.TON.decimals)} TON`)

  if (args.tokens.includes("TON")) {
    const gasForJettons = BigInt(args.tokens.filter((token) => token !== "TON").length) * toNano("0.09")
    const keep = args.tonReserve + gasForJettons
    const amount = tonBalance > keep ? tonBalance - keep : 0n
    console.log(`TON planned transfer: ${formatToken(amount, TOKENS.TON.decimals)} TON`)
    if (amount > 0n) {
      messages.push(internal({ to: Address.parse(toWallet.address), value: amount, bounce: false }))
    }
  }

  for (const symbol of args.tokens.filter((token) => token !== "TON")) {
    const token = TOKENS[symbol]
    const { jettonWalletAddress, balance } = await getJettonBalance(client, fromWallet.address, token.minter)
    console.log(`${symbol} balance: ${formatToken(balance, token.decimals)} ${symbol}`)
    console.log(`${symbol} planned transfer: ${formatToken(balance, token.decimals)} ${symbol}`)
    if (balance > 0n && jettonWalletAddress) {
      messages.push(
        internal({
          to: jettonWalletAddress,
          value: token.transferTon,
          bounce: true,
          body: jettonTransferBody({
            amount: balance,
            destination: toWallet.address,
            responseDestination: fromWallet.address,
          }),
        }),
      )
    }
  }

  if (!messages.length) {
    console.log("")
    console.log("No transferable balances found.")
    return
  }

  console.log("")
  console.log(`Prepared ${messages.length} transfer message(s).`)
  if (!args.execute) {
    console.log("Dry-run only. Re-run with --execute to broadcast.")
    return
  }

  const result = await sendMessages({ client, wallet, keypair, messages })
  console.log(`Broadcast tx hash: ${result.txHash}`)
  console.log(`Seqno advanced: ${result.sent ? "yes" : "not confirmed before timeout"}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
