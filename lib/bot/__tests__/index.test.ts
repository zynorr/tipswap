import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ─── Mock process.env before any module imports ───────────────────

const ORIG_ENV = process.env

beforeEach(() => {
  process.env = {
    ...ORIG_ENV,
    TELEGRAM_BOT_TOKEN: "fake:test-token",
    TELEGRAM_BOT_USERNAME: "tipswapbot",
    NEXT_PUBLIC_APP_URL: "https://app.example.com",
  }
  vi.clearAllMocks()
})

afterEach(() => {
  process.env = ORIG_ENV
})

// ─── Mock dependencies ───────────────────────────────────────────

vi.mock("@/lib/wallet/ton", () => ({
  getBalance: vi.fn(),
  getJettonBalance: vi.fn(),
  getNetworkDisplay: vi.fn(() => "TON Mainnet"),
}))
import { getBalance, getJettonBalance } from "@/lib/wallet/ton"

const mockGetBalance = vi.mocked(getBalance)
const mockGetJettonBalance = vi.mocked(getJettonBalance)

vi.mock("@/lib/ston/swap", () => ({
  resolveToken: vi.fn((symbol: string) => {
    const upper = symbol.toUpperCase()
    const TOKENS: Record<string, { mainnet: string; decimals: number }> = {
      TON: { mainnet: "TON", decimals: 9 },
      USDT: {
        mainnet: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
        decimals: 6,
      },
      STON: {
        mainnet: "EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmwG9T6bO",
        decimals: 9,
      },
    }
    const entry = TOKENS[upper]
    if (!entry) throw new Error(`Unknown token: ${symbol}. Supported: TON, USDT, STON`)
    return { symbol: upper, ...entry }
  }),
  TOKENS: {
    TON: { mainnet: "TON", decimals: 9 },
    USDT: { mainnet: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs", decimals: 6 },
    STON: { mainnet: "EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmwG9T6bO", decimals: 9 },
  },
  executeSwap: vi.fn(),
  quoteTipSwap: vi.fn(),
  executeTipSwap: vi.fn(),
}))
import { executeSwap, executeTipSwap, quoteTipSwap } from "@/lib/ston/swap"

const mockExecuteSwap = vi.mocked(executeSwap)
const mockQuoteTipSwap = vi.mocked(quoteTipSwap)
const mockExecuteTipSwap = vi.mocked(executeTipSwap)

vi.mock("@/lib/wallet/crypto", () => ({
  decryptString: vi.fn(() => "test mnemonic phrase"),
  encryptString: vi.fn(() => "encrypted"),
}))

vi.mock("../users", () => ({
  getOrCreateUser: vi.fn(),
  decryptMnemonic: vi.fn(() => "test mnemonic phrase"),
  logSwap: vi.fn(() => ({ id: "swap-log-1" })),
  updateSwapStatus: vi.fn(),
  connectExternalWallet: vi.fn(),
  getManagedWallet: vi.fn(),
  setActiveWallet: vi.fn(),
  updateUserPreferences: vi.fn(),
  findUserByUsername: vi.fn(),
  getActiveWallet: vi.fn(),
  getTipById: vi.fn(),
  getTipsByBatchId: vi.fn(),
  getTipBatchById: vi.fn(),
  getUserById: vi.fn(),
  getUserByTgId: vi.fn(),
  createTipBatch: vi.fn(),
  createTipQuote: vi.fn(),
  createTipClaimInvite: vi.fn(),
  getTipClaimByCode: vi.fn(),
  claimTipClaimForQuote: vi.fn(),
  updateTipClaimStatus: vi.fn(),
  claimTipForSend: vi.fn(),
  claimTipBatchForSend: vi.fn(),
  updateTipStatus: vi.fn(),
  updateTipBatchStatus: vi.fn(),
  recordGroupMessage: vi.fn(),
  getGroupMessageAuthor: vi.fn(),
  getRecentTipsForUser: vi.fn(),
  getRecentSwapsForUser: vi.fn(),
}))
import {
  getOrCreateUser,
  updateSwapStatus,
  connectExternalWallet,
  getManagedWallet,
  setActiveWallet,
  updateUserPreferences,
  findUserByUsername,
  getActiveWallet,
  getTipById,
  getTipsByBatchId,
  getTipBatchById,
  getUserById,
  getUserByTgId,
  createTipBatch,
  createTipQuote,
  createTipClaimInvite,
  getTipClaimByCode,
  claimTipClaimForQuote,
  updateTipClaimStatus,
  claimTipForSend,
  claimTipBatchForSend,
  updateTipStatus,
  updateTipBatchStatus,
  recordGroupMessage,
  getGroupMessageAuthor,
  getRecentTipsForUser,
  getRecentSwapsForUser,
} from "../users"

const mockGetOrCreateUser = vi.mocked(getOrCreateUser)
const mockUpdateSwapStatus = vi.mocked(updateSwapStatus)
const mockConnectExternalWallet = vi.mocked(connectExternalWallet)
const mockGetManagedWallet = vi.mocked(getManagedWallet)
const mockSetActiveWallet = vi.mocked(setActiveWallet)
const mockUpdateUserPreferences = vi.mocked(updateUserPreferences)
const mockFindUserByUsername = vi.mocked(findUserByUsername)
const mockGetActiveWallet = vi.mocked(getActiveWallet)
const mockGetTipById = vi.mocked(getTipById)
const mockGetTipsByBatchId = vi.mocked(getTipsByBatchId)
const mockGetTipBatchById = vi.mocked(getTipBatchById)
const mockGetUserById = vi.mocked(getUserById)
const mockGetUserByTgId = vi.mocked(getUserByTgId)
const mockCreateTipBatch = vi.mocked(createTipBatch)
const mockCreateTipQuote = vi.mocked(createTipQuote)
const mockCreateTipClaimInvite = vi.mocked(createTipClaimInvite)
const mockGetTipClaimByCode = vi.mocked(getTipClaimByCode)
const mockClaimTipClaimForQuote = vi.mocked(claimTipClaimForQuote)
const mockUpdateTipClaimStatus = vi.mocked(updateTipClaimStatus)
const mockClaimTipForSend = vi.mocked(claimTipForSend)
const mockClaimTipBatchForSend = vi.mocked(claimTipBatchForSend)
const mockUpdateTipStatus = vi.mocked(updateTipStatus)
const mockUpdateTipBatchStatus = vi.mocked(updateTipBatchStatus)
const mockRecordGroupMessage = vi.mocked(recordGroupMessage)
const mockGetGroupMessageAuthor = vi.mocked(getGroupMessageAuthor)
const mockGetRecentTipsForUser = vi.mocked(getRecentTipsForUser)
const mockGetRecentSwapsForUser = vi.mocked(getRecentSwapsForUser)

// ─── Mock grammY and set up handler capture ──────────────────────
// vi.mock factories are hoisted above module-scoped code, so we
// keep everything inside the factory closure and share state via globalThis.

type Ctx = {
  from: { id: number; username?: string; first_name?: string }
  match: unknown
  reply: ReturnType<typeof vi.fn>
  answerCallbackQuery?: ReturnType<typeof vi.fn>
  editMessageText?: ReturnType<typeof vi.fn>
  api?: { sendMessage: ReturnType<typeof vi.fn> }
}

type Handler = (ctx: Ctx) => Promise<void>

vi.mock("grammy", () => {
  const handlerMap = new Map<string, (ctx: any) => Promise<void>>()
  const callbackHandlers: Array<{
    matcher: RegExp
    handler: (ctx: any) => Promise<void>
  }> = []
  const onHandlers = new Map<string, (ctx: any, next: () => Promise<void>) => Promise<void>>()
  const reactionHandlers: Array<{
    reactions: string[]
    handler: (ctx: any) => Promise<void>
  }> = []
  ;(globalThis as any).__grammyHandlers = handlerMap
  ;(globalThis as any).__grammyCallbackHandlers = callbackHandlers
  ;(globalThis as any).__grammyOnHandlers = onHandlers
  ;(globalThis as any).__grammyReactionHandlers = reactionHandlers

  return {
    Bot: class MockBot {
      constructor(_token: string) {}
      command(cmd: string, handler: (ctx: any) => Promise<void>) {
        handlerMap.set(cmd, handler)
      }
      callbackQuery(matcher: RegExp, handler: (ctx: any) => Promise<void>) {
        callbackHandlers.push({ matcher, handler })
      }
      on(event: string, handler: (ctx: any, next: () => Promise<void>) => Promise<void>) {
        onHandlers.set(event, handler)
      }
      reaction(reactions: string[], handler: (ctx: any) => Promise<void>) {
        reactionHandlers.push({ reactions, handler })
      }
      catch() {}
    },
    InlineKeyboard: class MockInlineKeyboard {
      buttons: Array<{ text: string; data?: string; web_app?: { url: string } }> = []
      text(text: string, data: string) {
        this.buttons.push({ text, data })
        return this
      }
      webApp(text: string, url: string) {
        this.buttons.push({ text, web_app: { url } })
        return this
      }
    },
  }
})

function getRegisteredHandlers(): Map<string, Handler> {
  return (globalThis as any).__grammyHandlers as Map<string, Handler>
}

function getRegisteredCallbackHandlers(): Array<{
  matcher: RegExp
  handler: Handler
}> {
  return (globalThis as any).__grammyCallbackHandlers as Array<{
    matcher: RegExp
    handler: Handler
  }>
}

function getRegisteredOnHandlers(): Map<string, (ctx: any, next: () => Promise<void>) => Promise<void>> {
  return (globalThis as any).__grammyOnHandlers as Map<string, (ctx: any, next: () => Promise<void>) => Promise<void>>
}

function getRegisteredReactionHandlers(): Array<{
  reactions: string[]
  handler: Handler
}> {
  return (globalThis as any).__grammyReactionHandlers as Array<{
    reactions: string[]
    handler: Handler
  }>
}

// ─── Import after mocks are set up ────────────────────────────────

import { getBot } from "@/lib/bot/index"
import { isAutoReceiveToken, resolveReceiveTokenForRecipient } from "@/lib/bot/tips"

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Build a mock grammY command match from a raw text string.
 * grammY's command regex: /^\/([^\s@]+)(?:@(\S+))?\s*(\s[\s\S]*)?$|^\/([^\s@]+)(?:@(\S+))?\s*$/
 * ctx.match = RegExpExecArray where:
 *   [0] = full match
 *   [1] = command name
 *   [2] = @botname or undefined
 *   [3] = text after command or undefined
 *
 * See: https://github.com/grammyjs/grammY/blob/main/src/filters.ts
 */
function makeCtx(overrides: {
  command?: string
  argsText?: string
  from?: { id: number; username?: string; first_name?: string }
}): Ctx {
  const { command = "swap", argsText = "", from = { id: 12345, username: "testuser", first_name: "Test" } } = overrides

  return {
    from,
    match: argsText,
    reply: vi.fn().mockResolvedValue(undefined),
  }
}

const managedWallet = {
  id: "wallet-1",
  user_id: "user-1",
  address: "EQDabc123",
  public_key: "0x...",
  encrypted_mnemonic: "...",
  mode: "managed" as const,
  is_active: true,
}

const externalWallet = {
  id: "wallet-2",
  user_id: "user-1",
  address: "UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ",
  public_key: null,
  encrypted_mnemonic: null,
  mode: "external" as const,
  is_active: true,
}

const mockUser = {
  id: "user-1",
  tg_id: 12345,
  tg_username: "testuser",
  first_name: "Test",
  default_recv_token: "USDT",
  reaction_tip_amount: "1",
  reaction_recv_token: "USDT",
  reaction_pay_token: "TON",
}

const recipientUser = {
  id: "user-2",
  tg_id: 67890,
  tg_username: "alice",
  first_name: "Alice",
  default_recv_token: "USDT",
  reaction_tip_amount: "1",
  reaction_recv_token: "USDT",
  reaction_pay_token: "TON",
}

const recipientWallet = {
  id: "wallet-3",
  user_id: "user-2",
  address: "UQA7f7c1zn0J08RKt8WPXcXlnZLAtcN22UsFdcvaQqYU8AS8",
  public_key: null,
  encrypted_mnemonic: null,
  mode: "external" as const,
  is_active: true,
}

const recipientTwoUser = {
  id: "user-3",
  tg_id: 24680,
  tg_username: "bobuser",
  first_name: "Bob",
  default_recv_token: "USDT",
  reaction_tip_amount: "1",
  reaction_recv_token: "USDT",
  reaction_pay_token: "TON",
}

const recipientTwoWallet = {
  id: "wallet-4",
  user_id: "user-3",
  address: "UQCbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  public_key: null,
  encrypted_mnemonic: null,
  mode: "external" as const,
  is_active: true,
}

const newRecipientUser = {
  id: "user-4",
  tg_id: 77777,
  tg_username: "newuser",
  first_name: "New",
  default_recv_token: "USDT",
  reaction_tip_amount: "1",
  reaction_recv_token: "USDT",
  reaction_pay_token: "TON",
}

const newRecipientWallet = {
  id: "wallet-5",
  user_id: "user-4",
  address: "UQDnewrecipientwallet000000000000000000000000000",
  public_key: "0xnew",
  encrypted_mnemonic: "...",
  mode: "managed" as const,
  is_active: true,
}

const tipRow = {
  id: "11111111-1111-4111-8111-111111111111",
  batch_id: null,
  sender_user_id: "user-1",
  recipient_user_id: "user-2",
  source: "command" as const,
  source_chat_id: null,
  source_message_id: null,
  sender_wallet_id: "wallet-1",
  recipient_wallet_id: "wallet-3",
  recipient_address: recipientWallet.address,
  offer_token: "TON",
  ask_token: "USDT",
  ask_amount: "5",
  ask_raw: "5000000",
  quoted_offer_amount: "2.5000",
  offer_raw: "2500000000",
  expected_out: "5.0000",
  min_ask_amount: "4950000",
  slippage_bps: 100,
  status: "quoted" as const,
  tx_hash: null,
  error: null,
  expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const tipRowTwo = {
  ...tipRow,
  id: "33333333-3333-4333-8333-333333333333",
  batch_id: "22222222-2222-4222-8222-222222222222",
  recipient_user_id: "user-3",
  recipient_wallet_id: "wallet-4",
  recipient_address: recipientTwoWallet.address,
}

const batchRow = {
  id: "22222222-2222-4222-8222-222222222222",
  sender_user_id: "user-1",
  source: "command" as const,
  offer_token: "TON",
  ask_token: "USDT",
  ask_amount: "5",
  recipient_count: 2,
  quoted_total_offer_amount: "5.0000",
  status: "quoted" as const,
  error: null,
  expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const claimRow = {
  id: "44444444-4444-4444-8444-444444444444",
  code: "claimcode123",
  sender_user_id: "user-1",
  target_username: "newuser",
  offer_token: "TON",
  ask_token: "USDT",
  ask_amount: "5",
  status: "pending" as const,
  tip_id: null,
  error: null,
  expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// ─── Tests ────────────────────────────────────────────────────────

describe("bot command registration", () => {
  it("registers all command handlers", () => {
    getBot()
    const handlers = getRegisteredHandlers()
    for (const cmd of ["start", "help", "wallet", "balance", "connect", "managed", "swap", "tip", "receive", "settip", "settings", "history"]) {
      expect(handlers.has(cmd)).toBe(true)
    }
    expect(getRegisteredCallbackHandlers()).toHaveLength(1)
    expect(getRegisteredOnHandlers().has("message")).toBe(true)
    expect(getRegisteredReactionHandlers()).toHaveLength(1)
  })
})

// ─── /swap command parsing ───────────────────────────────────────

describe("/swap — argument parsing", () => {
  let handler: Handler

  beforeEach(() => {
    getBot()
    handler = getRegisteredHandlers().get("swap")!
  })

  it("accepts 3 valid arguments", async () => {
    const ctx = makeCtx({ command: "swap", argsText: "0.5 TON USDT" })
    await handler(ctx)
    // Should pass arg validation, not reply with usage
    // It will proceed further and attempt getOrCreateUser (mocked)
    expect(ctx.reply).not.toHaveBeenCalledWith(
      expect.stringContaining("Usage:"),
    )
  })

  it("replies with usage when no arguments are given", async () => {
    const ctx = makeCtx({ command: "swap", argsText: "" })
    await handler(ctx)
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Usage:"),
    )
  })

  it("replies with usage when only 1 argument is given", async () => {
    const ctx = makeCtx({ command: "swap", argsText: "0.5" })
    await handler(ctx)
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Usage:"),
    )
  })

  it("replies with usage when only 2 arguments are given", async () => {
    const ctx = makeCtx({ command: "swap", argsText: "0.5 TON" })
    await handler(ctx)
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Usage:"),
    )
  })

  it("replies with usage when 4 arguments are given", async () => {
    const ctx = makeCtx({ command: "swap", argsText: "0.5 TON USDT extra" })
    await handler(ctx)
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Usage:"),
    )
  })
})

describe("/swap — amount validation", () => {
  let handler: Handler

  beforeEach(() => {
    getBot()
    handler = getRegisteredHandlers().get("swap")!
  })

  it("accepts a decimal amount", async () => {
    const ctx = makeCtx({ command: "swap", argsText: "0.5 TON USDT" })
    await handler(ctx)
    // Should pass amount validation, not reply with amount error
    expect(ctx.reply).not.toHaveBeenCalledWith(
      expect.stringContaining("Amount must be a number"),
    )
  })

  it("accepts an integer amount", async () => {
    const ctx = makeCtx({ command: "swap", argsText: "10 TON USDT" })
    await handler(ctx)
    expect(ctx.reply).not.toHaveBeenCalledWith(
      expect.stringContaining("Amount must be a number"),
    )
  })

  it("rejects non-numeric amount", async () => {
    const ctx = makeCtx({ command: "swap", argsText: "abc TON USDT" })
    await handler(ctx)
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Amount must be a number"),
    )
  })

  it("rejects amount with multiple decimal points", async () => {
    const ctx = makeCtx({ command: "swap", argsText: "0.5.5 TON USDT" })
    await handler(ctx)
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Amount must be a number"),
    )
  })
})

describe("/swap — token validation", () => {
  let handler: Handler

  beforeEach(() => {
    getBot()
    handler = getRegisteredHandlers().get("swap")!

    // getOrCreateUser returns a valid user/wallet so we reach the resolveToken step
    mockGetOrCreateUser.mockResolvedValue({
      user: mockUser,
      wallet: { ...managedWallet, address: "EQD..." },
      created: false,
    })
  })

  it("rejects unknown offer token with supported list", async () => {
    const ctx = makeCtx({ command: "swap", argsText: "0.5 ETH USDT" })
    await handler(ctx)
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Unknown token: ETH"),
    )
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("TON, USDT, STON"),
    )
  })

  it("rejects unknown ask token with supported list", async () => {
    const ctx = makeCtx({ command: "swap", argsText: "0.5 TON ETH" })
    await handler(ctx)
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Unknown token: ETH"),
    )
  })

  it("rejects swaps where offer and ask token are the same", async () => {
    const ctx = makeCtx({ command: "swap", argsText: "0.5 TON TON" })
    await handler(ctx)
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Offer and ask tokens must be different"),
    )
  })
})

describe("/swap — flow with mocked dependencies", () => {
  let handler: Handler

  beforeEach(() => {
    getBot()
    handler = getRegisteredHandlers().get("swap")!
  })

  it("replies with 'swapping' status and then success message on completion", async () => {
    // Set up user lookup mock
    mockGetOrCreateUser.mockResolvedValue({
      user: mockUser,
      wallet: managedWallet,
      created: false,
    })

    // Set up swap execution mock
    mockExecuteSwap.mockResolvedValue({
      sent: true,
      seqno: 42,
      expectedOut: "0.2891",
      expectedRaw: "289100",
      minAskAmount: "286209",
      offerRaw: "500000000",
      txHash: "abc123",
      network: "mainnet",
    })

    const ctx = makeCtx({ command: "swap", argsText: "0.5 TON USDT" })
    await handler(ctx)

    // First reply: swapping status
    expect(ctx.reply).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("🔄 Swapping"),
      expect.objectContaining({ parse_mode: "HTML" }),
    )

    // Second reply: success message
    expect(ctx.reply).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("✅ Swap complete!"),
      expect.objectContaining({ parse_mode: "HTML" }),
    )

    // Success message contains the expected amount
    const successCall = ctx.reply.mock.calls[1][0] as string
    expect(successCall).toContain("0.2891")
    expect(successCall).toContain("USDT")
    expect(successCall).toContain("Seqno: 42")
    expect(successCall).toContain("tonviewer.com")
    expect(mockUpdateSwapStatus).toHaveBeenCalledWith(
      "swap-log-1",
      expect.objectContaining({
        status: "sent",
        expectedOut: "0.2891",
        txHash: "abc123",
      }),
    )
  })

  it("replies with failure message when swap fails to broadcast", async () => {
    mockGetOrCreateUser.mockResolvedValue({
      user: mockUser,
      wallet: managedWallet,
      created: false,
    })

    mockExecuteSwap.mockResolvedValue({
      sent: false,
      seqno: 41,
      expectedOut: "0.2891",
      expectedRaw: "289100",
      minAskAmount: "286209",
      offerRaw: "500000000",
      txHash: "def456",
      network: "mainnet",
    })

    const ctx = makeCtx({ command: "swap", argsText: "0.5 TON USDT" })
    await handler(ctx)

    // First reply: swapping
    expect(ctx.reply).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("🔄 Swapping"),
      expect.anything(),
    )

    // Second reply: pending/not confirmed
    expect(ctx.reply).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("⚠️ Transaction pending"),
      expect.anything(),
    )
  })

  it("replies with swap failure message on error", async () => {
    mockGetOrCreateUser.mockResolvedValue({
      user: mockUser,
      wallet: managedWallet,
      created: false,
    })

    mockExecuteSwap.mockRejectedValue(
      new Error("TON RPC: status code 500"),
    )

    const ctx = makeCtx({ command: "swap", argsText: "0.5 TON USDT" })
    await handler(ctx)

    // First reply: swapping
    expect(ctx.reply).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("🔄 Swapping"),
      expect.anything(),
    )

    // Second reply: swap failed
    expect(ctx.reply).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("Swap failed: TON RPC: status code 500"),
    )
  })

  it("does not execute swaps when the active wallet is external", async () => {
    mockGetOrCreateUser.mockResolvedValue({
      user: mockUser,
      wallet: externalWallet,
      created: false,
    })
    mockGetManagedWallet.mockResolvedValue(managedWallet)

    const ctx = makeCtx({ command: "swap", argsText: "0.5 TON USDT" })
    await handler(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("active wallet is external"),
      expect.objectContaining({ parse_mode: "HTML" }),
    )
    expect(mockExecuteSwap).not.toHaveBeenCalled()
  })
})

// ─── /tip command and confirmation flow ──────────────────────────

describe("/tip — quote flow", () => {
  let handler: Handler

  beforeEach(() => {
    getBot()
    handler = getRegisteredHandlers().get("tip")!

    mockGetOrCreateUser.mockResolvedValue({
      user: mockUser,
      wallet: managedWallet,
      created: false,
    })
    mockFindUserByUsername.mockResolvedValue(recipientUser)
    mockGetActiveWallet.mockResolvedValue(recipientWallet)
    mockQuoteTipSwap.mockResolvedValue({
      offerSymbol: "TON",
      askSymbol: "USDT",
      askAmount: "5",
      askRaw: "5000000",
      quotedOfferAmount: "2.5000",
      offerRaw: "2500000000",
      expectedOut: "5.0000",
      expectedRaw: "5000000",
      minAskAmount: "4950000",
      slippageBps: 100,
      routerVersion: "v2.2",
      network: "mainnet",
    })
    mockCreateTipQuote.mockResolvedValue(tipRow)
    mockCreateTipClaimInvite.mockResolvedValue(claimRow)
  })

  it("replies with usage for invalid syntax", async () => {
    const ctx = makeCtx({ command: "tip", argsText: "5 USDT TON @alice" })
    await handler(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("/tip <amount>"))
    expect(mockQuoteTipSwap).not.toHaveBeenCalled()
  })

  it("creates a tip quote and returns confirm/cancel buttons", async () => {
    const ctx = makeCtx({ command: "tip", argsText: "5 USDT from TON @alice" })
    await handler(ctx)

    expect(mockFindUserByUsername).toHaveBeenCalledWith("alice")
    expect(mockGetActiveWallet).toHaveBeenCalledWith("user-2")
    expect(mockQuoteTipSwap).toHaveBeenCalledWith({
      offer: "TON",
      ask: "USDT",
      askAmount: "5",
      slippageBps: 100,
    })
    expect(mockCreateTipQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        senderUserId: "user-1",
        recipientUserId: "user-2",
        recipientAddress: recipientWallet.address,
        offerToken: "TON",
        askToken: "USDT",
        askAmount: "5",
      }),
    )
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Confirm tip"),
      expect.objectContaining({
        parse_mode: "HTML",
        reply_markup: expect.objectContaining({
          buttons: expect.arrayContaining([
            { text: "Confirm", data: `tip:confirm:${tipRow.id}` },
            { text: "Cancel", data: `tip:cancel:${tipRow.id}` },
          ]),
        }),
      }),
    )
  })

  it("accepts the site syntax and defaults the pay token to TON", async () => {
    const ctx = makeCtx({ command: "tip", argsText: "5 USDT @alice" })
    await handler(ctx)

    expect(mockQuoteTipSwap).toHaveBeenCalledWith({
      offer: "TON",
      ask: "USDT",
      askAmount: "5",
      slippageBps: 100,
    })
    expect(mockCreateTipQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        offerToken: "TON",
        askToken: "USDT",
        askAmount: "5",
      }),
    )
  })

  it("resolves automatic receive tokens to the recipient preference", () => {
    expect(isAutoReceiveToken("AUTO")).toBe(true)
    expect(isAutoReceiveToken("PREFERENCE")).toBe(true)
    expect(isAutoReceiveToken("USDT")).toBe(false)

    expect(resolveReceiveTokenForRecipient("AUTO", { default_recv_token: "STON" }).symbol).toBe("STON")
    expect(resolveReceiveTokenForRecipient("PREFERENCE", { default_recv_token: "TON" }).symbol).toBe("TON")
    expect(resolveReceiveTokenForRecipient("USDT", { default_recv_token: "STON" }).symbol).toBe("USDT")
  })

  it("creates a batch quote for multiple recipients", async () => {
    mockFindUserByUsername.mockImplementation(async (username: string) => {
      if (username === "alice") return recipientUser
      if (username === "bobuser") return recipientTwoUser
      return null
    })
    mockGetActiveWallet.mockImplementation(async (userId: string) => {
      if (userId === "user-2") return recipientWallet
      if (userId === "user-3") return recipientTwoWallet
      throw new Error("missing wallet")
    })
    mockCreateTipBatch.mockResolvedValue(batchRow)
    mockCreateTipQuote
      .mockResolvedValueOnce({ ...tipRow, batch_id: batchRow.id })
      .mockResolvedValueOnce(tipRowTwo)

    const ctx = makeCtx({ command: "tip", argsText: "5 USDT @alice @bobuser" })
    await handler(ctx)

    expect(mockQuoteTipSwap).toHaveBeenCalledTimes(2)
    expect(mockCreateTipBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        senderUserId: "user-1",
        source: "command",
        offerToken: "TON",
        askToken: "USDT",
        askAmount: "5",
        recipientCount: 2,
        quotedTotalOfferAmount: "5.0000",
      }),
    )
    expect(mockCreateTipQuote).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ batchId: batchRow.id, recipientUserId: "user-2" }),
    )
    expect(mockCreateTipQuote).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ batchId: batchRow.id, recipientUserId: "user-3" }),
    )
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Recipients: <b>2</b>"),
      expect.objectContaining({
        reply_markup: expect.objectContaining({
          buttons: expect.arrayContaining([
            { text: "Confirm", data: `tipbatch:confirm:${batchRow.id}` },
            { text: "Cancel", data: `tipbatch:cancel:${batchRow.id}` },
          ]),
        }),
      }),
    )
  })

  it("does not quote when the active wallet is external", async () => {
    mockGetOrCreateUser.mockResolvedValue({
      user: mockUser,
      wallet: externalWallet,
      created: false,
    })
    mockGetManagedWallet.mockResolvedValue(managedWallet)

    const ctx = makeCtx({ command: "tip", argsText: "5 USDT from TON @alice" })
    await handler(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("active wallet is external"),
      expect.objectContaining({ parse_mode: "HTML" }),
    )
    expect(mockQuoteTipSwap).not.toHaveBeenCalled()
  })

  it("creates a claim link when a single recipient has not registered", async () => {
    mockFindUserByUsername.mockResolvedValue(null)

    const ctx = makeCtx({ command: "tip", argsText: "5 USDT from TON @alice" })
    await handler(ctx)

    expect(mockCreateTipClaimInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        senderUserId: "user-1",
        targetUsername: "alice",
        offerToken: "TON",
        askToken: "USDT",
        askAmount: "5",
      }),
    )
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("https://t.me/tipswapbot?start=claim_claimcode123"),
      expect.objectContaining({ parse_mode: "HTML" }),
    )
    expect(mockQuoteTipSwap).not.toHaveBeenCalled()
  })

  it("does not create claim links inside multi-recipient batches", async () => {
    mockFindUserByUsername.mockImplementation(async (username: string) => {
      if (username === "alice") return recipientUser
      return null
    })
    mockGetActiveWallet.mockResolvedValue(recipientWallet)

    const ctx = makeCtx({ command: "tip", argsText: "5 USDT @alice @newuser" })
    await handler(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Claim links currently support one unregistered recipient at a time"),
    )
    expect(mockCreateTipClaimInvite).not.toHaveBeenCalled()
    expect(mockQuoteTipSwap).not.toHaveBeenCalled()
  })

  it("rejects batches above the production recipient limit", async () => {
    const ctx = makeCtx({
      command: "tip",
      argsText: "5 USDT @alice @bobuser @caroluser @daveuser",
    })

    await handler(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("up to 3 recipients"))
    expect(mockQuoteTipSwap).not.toHaveBeenCalled()
  })
})

describe("/tip callback — confirm/cancel", () => {
  let handler: Handler

  function makeCallbackCtx(action: "confirm" | "cancel", row = tipRow): Ctx {
    return {
      from: { id: 12345, username: "testuser", first_name: "Test" },
      match: [`tip:${action}:${row.id}`, "tip", action, row.id],
      reply: vi.fn().mockResolvedValue(undefined),
      answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
      editMessageText: vi.fn().mockResolvedValue(undefined),
      api: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    }
  }

  beforeEach(() => {
    getBot()
    handler = getRegisteredCallbackHandlers()[0].handler

    mockGetTipById.mockResolvedValue(tipRow)
    mockGetUserById.mockImplementation(async (id: string) => {
      if (id === "user-1") return mockUser
      if (id === "user-2") return recipientUser
      return null
    })
    mockClaimTipForSend.mockResolvedValue({ ...tipRow, status: "sending" })
    mockGetManagedWallet.mockResolvedValue(managedWallet)
    mockExecuteTipSwap.mockResolvedValue({
      sent: true,
      seqno: 44,
      offerAmount: "2.5000",
      offerRaw: "2500000000",
      expectedOut: "5.0000",
      expectedRaw: "5000000",
      askRaw: "5000000",
      minAskAmount: "4950000",
      slippageBps: 100,
      txHash: "tip-tx",
      network: "mainnet",
    })
  })

  it("cancels a quoted tip", async () => {
    const ctx = makeCallbackCtx("cancel")
    await handler(ctx)

    expect(mockUpdateTipStatus).toHaveBeenCalledWith(tipRow.id, {
      status: "cancelled",
    })
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining("Tip cancelled"),
      expect.objectContaining({ parse_mode: "HTML" }),
    )
    expect(mockExecuteTipSwap).not.toHaveBeenCalled()
  })

  it("executes a confirmed tip and notifies the recipient", async () => {
    const ctx = makeCallbackCtx("confirm")
    await handler(ctx)

    expect(mockClaimTipForSend).toHaveBeenCalledWith(tipRow.id)
    expect(mockExecuteTipSwap).toHaveBeenCalledWith({
      mnemonic: "test mnemonic phrase",
      senderAddress: managedWallet.address,
      recipientAddress: recipientWallet.address,
      offer: "TON",
      ask: "USDT",
      askAmount: "5",
      slippageBps: 100,
    })
    expect(mockUpdateTipStatus).toHaveBeenCalledWith(
      tipRow.id,
      expect.objectContaining({
        status: "sent",
        expectedOut: "5.0000",
        txHash: "tip-tx",
      }),
    )
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining("Tip sent"),
      expect.objectContaining({ parse_mode: "HTML" }),
    )
    expect(ctx.api?.sendMessage).toHaveBeenCalledWith(
      67890,
      expect.stringContaining("You received a tip"),
      expect.objectContaining({ parse_mode: "HTML" }),
    )
  })

  it("rejects callbacks from non-senders", async () => {
    mockGetUserById.mockResolvedValue({ ...mockUser, tg_id: 99999 })

    const ctx = makeCallbackCtx("confirm")
    await handler(ctx)

    expect(ctx.answerCallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({ show_alert: true }),
    )
    expect(mockClaimTipForSend).not.toHaveBeenCalled()
  })
})

describe("/tipbatch callback — confirm/cancel", () => {
  let handler: Handler

  function makeBatchCallbackCtx(action: "confirm" | "cancel"): Ctx {
    return {
      from: { id: 12345, username: "testuser", first_name: "Test" },
      match: [`tipbatch:${action}:${batchRow.id}`, "tipbatch", action, batchRow.id],
      reply: vi.fn().mockResolvedValue(undefined),
      answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
      editMessageText: vi.fn().mockResolvedValue(undefined),
      api: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    }
  }

  beforeEach(() => {
    getBot()
    handler = getRegisteredCallbackHandlers()[0].handler

    mockGetTipBatchById.mockResolvedValue(batchRow)
    mockGetTipsByBatchId
      .mockResolvedValueOnce([{ ...tipRow, batch_id: batchRow.id }, tipRowTwo])
      .mockResolvedValue([{ ...tipRow, batch_id: batchRow.id, status: "sent" }, { ...tipRowTwo, status: "sent" }])
    mockGetUserById.mockImplementation(async (id: string) => {
      if (id === "user-1") return mockUser
      if (id === "user-2") return recipientUser
      if (id === "user-3") return recipientTwoUser
      return null
    })
    mockClaimTipBatchForSend.mockResolvedValue({ ...batchRow, status: "sending" })
    mockClaimTipForSend
      .mockResolvedValueOnce({ ...tipRow, batch_id: batchRow.id, status: "sending" })
      .mockResolvedValueOnce({ ...tipRowTwo, status: "sending" })
    mockGetManagedWallet.mockResolvedValue(managedWallet)
    mockExecuteTipSwap.mockResolvedValue({
      sent: true,
      seqno: 44,
      offerAmount: "2.5000",
      offerRaw: "2500000000",
      expectedOut: "5.0000",
      expectedRaw: "5000000",
      askRaw: "5000000",
      minAskAmount: "4950000",
      slippageBps: 100,
      txHash: "tip-tx",
      network: "mainnet",
    })
  })

  it("cancels every quoted tip in a batch", async () => {
    const ctx = makeBatchCallbackCtx("cancel")
    await handler(ctx)

    expect(mockUpdateTipStatus).toHaveBeenCalledWith(tipRow.id, { status: "cancelled" })
    expect(mockUpdateTipStatus).toHaveBeenCalledWith(tipRowTwo.id, { status: "cancelled" })
    expect(mockUpdateTipBatchStatus).toHaveBeenCalledWith(batchRow.id, { status: "cancelled" })
    expect(mockExecuteTipSwap).not.toHaveBeenCalled()
  })

  it("executes each tip in a confirmed batch", async () => {
    const ctx = makeBatchCallbackCtx("confirm")
    await handler(ctx)

    expect(mockClaimTipBatchForSend).toHaveBeenCalledWith(batchRow.id)
    expect(mockClaimTipForSend).toHaveBeenCalledWith(tipRow.id)
    expect(mockClaimTipForSend).toHaveBeenCalledWith(tipRowTwo.id)
    expect(mockExecuteTipSwap).toHaveBeenCalledTimes(2)
    expect(mockUpdateTipBatchStatus).toHaveBeenCalledWith(batchRow.id, {
      status: "sent",
      error: null,
    })
    expect(ctx.editMessageText).toHaveBeenLastCalledWith(
      expect.stringContaining("Tips sent"),
      expect.objectContaining({ parse_mode: "HTML" }),
    )
  })
})

describe("tip settings and history commands", () => {
  beforeEach(() => {
    getBot()
    mockGetOrCreateUser.mockResolvedValue({
      user: mockUser,
      wallet: managedWallet,
      created: false,
    })
  })

  it("/receive updates the default receive token", async () => {
    const handler = getRegisteredHandlers().get("receive")!
    const ctx = makeCtx({ command: "receive", argsText: "STON" })

    await handler(ctx)

    expect(mockUpdateUserPreferences).toHaveBeenCalledWith("user-1", {
      defaultRecvToken: "STON",
    })
    expect(ctx.reply).toHaveBeenCalledWith("Default receive token set to STON.")
  })

  it("/settip updates reaction tip defaults", async () => {
    const handler = getRegisteredHandlers().get("settip")!
    const ctx = makeCtx({ command: "settip", argsText: "1 USDT from TON" })

    await handler(ctx)

    expect(mockUpdateUserPreferences).toHaveBeenCalledWith("user-1", {
      reactionTipAmount: "1",
      reactionRecvToken: "USDT",
      reactionPayToken: "TON",
    })
    expect(ctx.reply).toHaveBeenCalledWith(
      "Reaction tip default set to 1 USDT from TON.",
    )
  })

  it("/settings shows wallet and tip preferences", async () => {
    const handler = getRegisteredHandlers().get("settings")!
    const ctx = makeCtx({ command: "settings" })

    await handler(ctx)

    const text = ctx.reply.mock.calls[0][0] as string
    expect(text).toContain("TipSwap Settings")
    expect(text).toContain("Receive token: <b>USDT</b>")
    expect(text).toContain("Reaction tip: <b>1 USDT</b> from <b>TON</b>")
  })

  it("/history lists recent swaps and tips", async () => {
    const handler = getRegisteredHandlers().get("history")!
    mockGetRecentTipsForUser.mockResolvedValue([{ ...tipRow, status: "sent", tx_hash: "abcdef123456" }])
    mockGetRecentSwapsForUser.mockResolvedValue([
      {
        id: "swap-1",
        user_id: "user-1",
        offer_token: "TON",
        ask_token: "USDT",
        offer_amount: "0.5",
        expected_out: "1.0",
        slippage_bps: 100,
        tx_hash: "123456abcdef",
        status: "sent",
        error: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    const ctx = makeCtx({ command: "history" })

    await handler(ctx)

    const text = ctx.reply.mock.calls[0][0] as string
    expect(text).toContain("Recent Activity")
    expect(text).toContain("sent: 5 USDT sent")
    expect(text).toContain("0.5 TON")
  })
})

describe("group message tracking and reaction tips", () => {
  beforeEach(() => {
    getBot()
    mockGetUserByTgId.mockResolvedValue(mockUser)
    mockGetOrCreateUser.mockResolvedValue({
      user: mockUser,
      wallet: managedWallet,
      created: false,
    })
    mockGetGroupMessageAuthor.mockResolvedValue({
      id: "group-message-1",
      chat_id: -100,
      message_id: 10,
      author_user_id: "user-2",
      author_tg_id: 67890,
      author_username: "alice",
      created_at: new Date().toISOString(),
    })
    mockGetUserById.mockResolvedValue(recipientUser)
    mockGetActiveWallet.mockImplementation(async (userId: string) => {
      if (userId === "user-1") return managedWallet
      if (userId === "user-2") return recipientWallet
      throw new Error("missing wallet")
    })
    mockQuoteTipSwap.mockResolvedValue({
      offerSymbol: "TON",
      askSymbol: "USDT",
      askAmount: "1",
      askRaw: "1000000",
      quotedOfferAmount: "0.5000",
      offerRaw: "500000000",
      expectedOut: "1.0000",
      expectedRaw: "1000000",
      minAskAmount: "990000",
      slippageBps: 100,
      routerVersion: "v2.2",
      network: "mainnet",
    })
    mockCreateTipQuote.mockResolvedValue({
      ...tipRow,
      source: "reaction",
      ask_amount: "1",
      ask_raw: "1000000",
      quoted_offer_amount: "0.5000",
      offer_raw: "500000000",
      expected_out: "1.0000",
      min_ask_amount: "990000",
      source_chat_id: -100,
      source_message_id: 10,
    })
  })

  it("records group messages only for registered users", async () => {
    const handler = getRegisteredOnHandlers().get("message")!
    const next = vi.fn().mockResolvedValue(undefined)

    await handler(
      {
        from: { id: 12345, username: "testuser", first_name: "Test", is_bot: false },
        message: {
          message_id: 10,
          chat: { id: -100, type: "group" },
        },
      },
      next,
    )

    expect(mockGetUserByTgId).toHaveBeenCalledWith(12345)
    expect(mockRecordGroupMessage).toHaveBeenCalledWith({
      chatId: -100,
      messageId: 10,
      authorUserId: "user-1",
      authorTgId: 12345,
      authorUsername: "testuser",
    })
    expect(next).toHaveBeenCalled()
  })

  it("quotes a reaction tip and DMs the sender for confirmation", async () => {
    const handler = getRegisteredReactionHandlers()[0].handler
    const ctx = {
      from: { id: 12345, username: "testuser", first_name: "Test" },
      messageReaction: {
        chat: { id: -100 },
        message_id: 10,
      },
      api: { sendMessage: vi.fn().mockResolvedValue(undefined) },
      reply: vi.fn().mockResolvedValue(undefined),
      match: "",
    } as unknown as Ctx & { messageReaction: unknown }

    await handler(ctx)

    expect(mockGetUserByTgId).toHaveBeenCalledWith(12345)
    expect(mockQuoteTipSwap).toHaveBeenCalledWith({
      offer: "TON",
      ask: "USDT",
      askAmount: "1",
      slippageBps: 100,
    })
    expect(mockCreateTipQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "reaction",
        sourceChatId: -100,
        sourceMessageId: 10,
        recipientUserId: "user-2",
      }),
    )
    expect(ctx.api?.sendMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining("Source: reaction tip"),
      expect.objectContaining({
        reply_markup: expect.objectContaining({
          buttons: expect.arrayContaining([
            { text: "Confirm", data: `tip:confirm:${tipRow.id}` },
          ]),
        }),
      }),
    )
  })
})

// ─── /help message format ─────────────────────────────────────────

describe("/help — message format", () => {
  let handler: Handler

  beforeEach(() => {
    getBot()
    handler = getRegisteredHandlers().get("help")!
  })

  it("includes TipSwap Help header, all commands, supported tokens, and network", async () => {
    const ctx = makeCtx({ command: "help" })
    await handler(ctx)

    const text = ctx.reply.mock.calls[0][0] as string
    expect(text).toContain("🤖 TipSwap Help")
    expect(text).toContain("/start")
    expect(text).toContain("/wallet")
    expect(text).toContain("/balance")
    expect(text).toContain("/connect")
    expect(text).toContain("/managed")
    expect(text).toContain("/swap")
    expect(text).toContain("TON, USDT, STON")
    expect(text).toContain("TON Mainnet")
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        reply_markup: expect.objectContaining({
          buttons: expect.arrayContaining([
            expect.objectContaining({
              text: "Open Mini App",
              web_app: { url: "https://app.example.com/miniapp" },
            }),
          ]),
        }),
      }),
    )
  })
})

// ─── /wallet message format ───────────────────────────────────────

describe("/wallet — message format", () => {
  let handler: Handler

  beforeEach(() => {
    getBot()
    handler = getRegisteredHandlers().get("wallet")!

    mockGetOrCreateUser.mockResolvedValue({
      user: mockUser,
      wallet: managedWallet,
      created: false,
    })

    mockGetBalance.mockResolvedValue(2_500_000_000n) // 2.5 TON
  })

  it("replies with wallet address, balance, and network", async () => {
    const ctx = makeCtx({ command: "wallet" })
    await handler(ctx)

    const text = ctx.reply.mock.calls[0][0] as string
    expect(text).toContain("💼 Your TipSwap Wallet")
    expect(text).toContain("managed")
    expect(text).toContain("EQDabc123")
    expect(text).toContain("2.5")
    expect(text).toContain("TON")
    expect(text).toContain("TON Mainnet")
    expect(text).toContain("USDT") // default_recv_token
  })

  it("replies with error when user lookup fails", async () => {
    mockGetOrCreateUser.mockRejectedValue(
      new Error("Supabase connection failed"),
    )

    const ctx = makeCtx({ command: "wallet" })
    await handler(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Wallet lookup failed"),
    )
  })
})

// ─── /connect and /managed ────────────────────────────────────────

describe("wallet mode commands", () => {
  beforeEach(() => {
    getBot()
    mockGetOrCreateUser.mockResolvedValue({
      user: mockUser,
      wallet: managedWallet,
      created: false,
    })
    mockConnectExternalWallet.mockResolvedValue(externalWallet)
    mockSetActiveWallet.mockResolvedValue(managedWallet)
    mockGetBalance.mockResolvedValue(2_500_000_000n)
  })

  it("/connect stores an external wallet and marks it active", async () => {
    const handler = getRegisteredHandlers().get("connect")!
    const ctx = makeCtx({
      command: "connect",
      argsText: "UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ",
    })

    await handler(ctx)

    expect(mockConnectExternalWallet).toHaveBeenCalledWith(
      "user-1",
      "UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ",
    )
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("External wallet connected"),
      expect.objectContaining({ parse_mode: "HTML" }),
    )
  })

  it("/connect rejects invalid wallet addresses", async () => {
    const handler = getRegisteredHandlers().get("connect")!
    const ctx = makeCtx({ command: "connect", argsText: "not-a-wallet" })

    await handler(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("valid TON wallet address"),
    )
    expect(mockConnectExternalWallet).not.toHaveBeenCalled()
  })

  it("/managed switches the active wallet back to managed", async () => {
    const handler = getRegisteredHandlers().get("managed")!
    const ctx = makeCtx({ command: "managed" })

    await handler(ctx)

    expect(mockSetActiveWallet).toHaveBeenCalledWith("user-1", "managed")
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Managed wallet active"),
      expect.objectContaining({ parse_mode: "HTML" }),
    )
  })
})

// ─── /balance message format ──────────────────────────────────────

describe("/balance — message format", () => {
  let handler: Handler

  beforeEach(() => {
    getBot()
    handler = getRegisteredHandlers().get("balance")!

    mockGetOrCreateUser.mockResolvedValue({
      user: mockUser,
      wallet: managedWallet,
      created: false,
    })

    mockGetBalance.mockResolvedValue(5_000_000_000n) // 5 TON
    mockGetJettonBalance.mockImplementation(async (_addr: string, minter: string) => {
      if (minter.includes("EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs")) {
        return 10_500_000n // 10.5 USDT (6 decimals)
      }
      if (minter.includes("EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmwG9T6bO")) {
        return 100_000_000_000n // 100 STON (9 decimals)
      }
      return 0n
    })
  })

  it("replies with TON, USDT, STON balances and tonviewer link", async () => {
    const ctx = makeCtx({ command: "balance" })
    await handler(ctx)

    const text = ctx.reply.mock.calls[0][0] as string
    expect(text).toContain("💰 Token Balances")
    expect(text).toContain("5")       // TON
    expect(text).toContain("10.5000") // USDT (10.5000 formatted)
    expect(text).toContain("100")     // STON
    expect(text).toContain("TON Mainnet")
    expect(text).toContain("tonviewer.com")
  })
})

// ─── /start message format ────────────────────────────────────────

describe("/start — message format", () => {
  let handler: Handler

  beforeEach(() => {
    getBot()
    handler = getRegisteredHandlers().get("start")!
  })

  it("replies with welcome message for new users", async () => {
    mockGetOrCreateUser.mockResolvedValue({
      user: mockUser,
      wallet: managedWallet,
      created: true,
    })

    const ctx = makeCtx({ command: "start" })
    await handler(ctx)

    const text = ctx.reply.mock.calls[0][0] as string
    expect(text).toContain("✨ Welcome to TipSwap")
    expect(text).toContain("I just created a managed TON wallet for you:")
    expect(text).toContain("EQDabc123")
    expect(text).toContain("/swap 0.1 TON USDT")
    expect(text).toContain("TON Mainnet")
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        reply_markup: expect.objectContaining({
          buttons: expect.arrayContaining([
            expect.objectContaining({
              text: "Open Mini App",
              web_app: { url: "https://app.example.com/miniapp" },
            }),
          ]),
        }),
      }),
    )
  })

  it("replies with welcome back message for returning users", async () => {
    mockGetOrCreateUser.mockResolvedValue({
      user: mockUser,
      wallet: managedWallet,
      created: false,
    })

    const ctx = makeCtx({ command: "start" })
    await handler(ctx)

    const text = ctx.reply.mock.calls[0][0] as string
    expect(text).toContain("👋 Welcome back")
    expect(text).toContain("EQDabc123")
    expect(text).toContain("/balance, /wallet, /connect, /managed, /swap, /tip, /settings, or /help")
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        reply_markup: expect.objectContaining({
          buttons: expect.arrayContaining([
            expect.objectContaining({
              text: "Open Mini App",
              web_app: { url: "https://app.example.com/miniapp" },
            }),
          ]),
        }),
      }),
    )
  })

  it("does not reply when ctx.from is missing", async () => {
    const ctx = { ...makeCtx({ command: "start" }), from: undefined } as unknown as Ctx
    await handler(ctx)
    expect(ctx.reply).not.toHaveBeenCalled()
  })
})

describe("/start — claim links", () => {
  let handler: Handler

  beforeEach(() => {
    getBot()
    handler = getRegisteredHandlers().get("start")!
    mockGetTipClaimByCode.mockResolvedValue(claimRow)
    mockClaimTipClaimForQuote.mockResolvedValue({ ...claimRow, status: "quoting" })
    mockGetOrCreateUser.mockResolvedValue({
      user: newRecipientUser,
      wallet: newRecipientWallet,
      created: true,
    })
    mockGetUserById.mockImplementation(async (id: string) => {
      if (id === "user-1") return mockUser
      if (id === "user-4") return newRecipientUser
      return null
    })
    mockGetManagedWallet.mockResolvedValue(managedWallet)
    mockQuoteTipSwap.mockResolvedValue({
      offerSymbol: "TON",
      askSymbol: "USDT",
      askAmount: "5",
      askRaw: "5000000",
      quotedOfferAmount: "2.5000",
      offerRaw: "2500000000",
      expectedOut: "5.0000",
      expectedRaw: "5000000",
      minAskAmount: "4950000",
      slippageBps: 100,
      routerVersion: "v2.2",
      network: "mainnet",
    })
    mockCreateTipQuote.mockResolvedValue({
      ...tipRow,
      id: "55555555-5555-4555-8555-555555555555",
      recipient_user_id: "user-4",
      recipient_wallet_id: "wallet-5",
      recipient_address: newRecipientWallet.address,
    })
  })

  it("creates a normal tip quote and asks the sender to confirm", async () => {
    const ctx = {
      ...makeCtx({
        command: "start",
        argsText: "claim_claimcode123",
        from: { id: 77777, username: "newuser", first_name: "New" },
      }),
      api: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    } as Ctx

    await handler(ctx)

    expect(mockGetTipClaimByCode).toHaveBeenCalledWith("claimcode123")
    expect(mockClaimTipClaimForQuote).toHaveBeenCalledWith(claimRow.id)
    expect(mockCreateTipQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        senderUserId: "user-1",
        recipientUserId: "user-4",
        recipientWalletId: "wallet-5",
        recipientAddress: newRecipientWallet.address,
        offerToken: "TON",
        askToken: "USDT",
        askAmount: "5",
      }),
    )
    expect(ctx.api?.sendMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining("@newuser opened your TipSwap claim link"),
      expect.objectContaining({
        parse_mode: "HTML",
        reply_markup: expect.objectContaining({
          buttons: expect.arrayContaining([
            { text: "Confirm", data: "tip:confirm:55555555-5555-4555-8555-555555555555" },
          ]),
        }),
      }),
    )
    expect(mockUpdateTipClaimStatus).toHaveBeenCalledWith(claimRow.id, {
      status: "quoted",
      tipId: "55555555-5555-4555-8555-555555555555",
      error: null,
    })
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Tip claim ready"),
      expect.objectContaining({ parse_mode: "HTML" }),
    )
  })

  it("rejects claim links opened by a different Telegram username", async () => {
    const ctx = makeCtx({
      command: "start",
      argsText: "claim_claimcode123",
      from: { id: 77777, username: "someoneelse", first_name: "New" },
    })

    await handler(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("This claim link is for @newuser"))
    expect(mockClaimTipClaimForQuote).not.toHaveBeenCalled()
    expect(mockCreateTipQuote).not.toHaveBeenCalled()
  })

  it("does not rebuild a claim that is already waiting for confirmation", async () => {
    mockGetTipClaimByCode.mockResolvedValue({
      ...claimRow,
      status: "quoted",
      tip_id: tipRow.id,
    })
    mockGetTipById.mockResolvedValue(tipRow)

    const ctx = makeCtx({
      command: "start",
      argsText: "claim_claimcode123",
      from: { id: 77777, username: "newuser", first_name: "New" },
    })

    await handler(ctx)

    expect(ctx.reply).toHaveBeenCalledWith("This claim is already waiting for the sender to confirm.")
    expect(mockClaimTipClaimForQuote).not.toHaveBeenCalled()
    expect(mockCreateTipQuote).not.toHaveBeenCalled()
  })
})
