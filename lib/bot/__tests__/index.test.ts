import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ─── Mock process.env before any module imports ───────────────────

const ORIG_ENV = process.env

beforeEach(() => {
  process.env = { ...ORIG_ENV, TELEGRAM_BOT_TOKEN: "fake:test-token" }
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
}))
import { executeSwap } from "@/lib/ston/swap"

vi.mock("@/lib/wallet/crypto", () => ({
  decryptString: vi.fn(() => "test mnemonic phrase"),
  encryptString: vi.fn(() => "encrypted"),
}))

vi.mock("../users", () => ({
  getOrCreateUser: vi.fn(),
  decryptMnemonic: vi.fn(() => "test mnemonic phrase"),
  logSwap: vi.fn(() => ({ id: "swap-log-1" })),
  updateSwapStatus: vi.fn(),
}))
import { getOrCreateUser, logSwap } from "../users"

// ─── Mock grammY and set up handler capture ──────────────────────
// vi.mock factories are hoisted above module-scoped code, so we
// keep everything inside the factory closure and share state via globalThis.

type Ctx = {
  from: { id: number; username?: string; first_name?: string }
  match: RegExpExecArray | null
  reply: ReturnType<typeof vi.fn>
}

type Handler = (ctx: Ctx) => Promise<void>

vi.mock("grammy", () => {
  const handlerMap = new Map<string, (ctx: any) => Promise<void>>()
  ;(globalThis as any).__grammyHandlers = handlerMap

  return {
    Bot: class MockBot {
      constructor(_token: string) {}
      command(cmd: string, handler: (ctx: any) => Promise<void>) {
        handlerMap.set(cmd, handler)
      }
      catch() {}
    },
  }
})

function getRegisteredHandlers(): Map<string, Handler> {
  return (globalThis as any).__grammyHandlers as Map<string, Handler>
}

// ─── Import after mocks are set up ────────────────────────────────

import { getBot } from "@/lib/bot/index"

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

  const fullText = argsText ? `/${command} ${argsText}` : `/${command}`
  const match = fullText.match(
    /^\/([^\s@]+)(?:@(\S+))?\s*((?:[\s\S])*)?$/,
  ) as RegExpExecArray | null

  return {
    from,
    match,
    reply: vi.fn().mockResolvedValue(undefined),
  }
}

/**
 * Simulate the grammY command regex match more explicitly.
 * For a message "/swap 0.5 TON USDT":
 *   match[0] = "/swap 0.5 TON USDT"
 *   match[1] = "swap"
 *   match[2] = undefined
 *   match[3] = "0.5 TON USDT"
 */
function createMatch(
  command: string,
  argsText: string | undefined,
): RegExpExecArray {
  const text = argsText !== undefined ? `/${command} ${argsText}` : `/${command}`
  const re = /^\/([^\s@]+)(?:@(\S+))?\s*((?:[\s\S])*)?$/
  return re.exec(text) as RegExpExecArray
}

// ─── Tests ────────────────────────────────────────────────────────

describe("bot command registration", () => {
  it("registers all five command handlers", () => {
    getBot()
    const handlers = getRegisteredHandlers()
    for (const cmd of ["start", "help", "wallet", "balance", "swap"]) {
      expect(handlers.has(cmd)).toBe(true)
    }
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
    ;(getOrCreateUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1", tg_id: 12345, tg_username: "testuser", first_name: "Test", default_recv_token: "USDT" },
      wallet: { id: "wallet-1", user_id: "user-1", address: "EQD...", public_key: "0x...", encrypted_mnemonic: "..." },
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
})

describe("/swap — flow with mocked dependencies", () => {
  let handler: Handler

  beforeEach(() => {
    getBot()
    handler = getRegisteredHandlers().get("swap")!
  })

  it("replies with 'swapping' status and then success message on completion", async () => {
    // Set up user lookup mock
    ;(getOrCreateUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1", tg_id: 12345, tg_username: "testuser", first_name: "Test", default_recv_token: "USDT" },
      wallet: { id: "wallet-1", user_id: "user-1", address: "EQDabc123", public_key: "0x...", encrypted_mnemonic: "..." },
      created: false,
    })

    // Set up swap execution mock
    ;(executeSwap as ReturnType<typeof vi.fn>).mockResolvedValue({
      sent: true,
      seqno: 42,
      expectedOut: "0.2891",
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
  })

  it("replies with failure message when swap fails to broadcast", async () => {
    ;(getOrCreateUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1", tg_id: 12345, tg_username: "testuser", first_name: "Test", default_recv_token: "USDT" },
      wallet: { id: "wallet-1", user_id: "user-1", address: "EQDabc123", public_key: "0x...", encrypted_mnemonic: "..." },
      created: false,
    })

    ;(executeSwap as ReturnType<typeof vi.fn>).mockResolvedValue({
      sent: false,
      seqno: 41,
      expectedOut: null,
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
    ;(getOrCreateUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1", tg_id: 12345, tg_username: "testuser", first_name: "Test", default_recv_token: "USDT" },
      wallet: { id: "wallet-1", user_id: "user-1", address: "EQDabc123", public_key: "0x...", encrypted_mnemonic: "..." },
      created: false,
    })

    ;(executeSwap as ReturnType<typeof vi.fn>).mockRejectedValue(
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
    expect(text).toContain("/swap")
    expect(text).toContain("TON, USDT, STON")
    expect(text).toContain("TON Mainnet")
  })
})

// ─── /wallet message format ───────────────────────────────────────

describe("/wallet — message format", () => {
  let handler: Handler

  beforeEach(() => {
    getBot()
    handler = getRegisteredHandlers().get("wallet")!

    ;(getOrCreateUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1", tg_id: 12345, tg_username: "testuser", first_name: "Test", default_recv_token: "USDT" },
      wallet: { id: "wallet-1", user_id: "user-1", address: "EQDabc123", public_key: "0x...", encrypted_mnemonic: "..." },
      created: false,
    })

    getBalance.mockResolvedValue(2_500_000_000n) // 2.5 TON
  })

  it("replies with wallet address, balance, and network", async () => {
    const ctx = makeCtx({ command: "wallet" })
    await handler(ctx)

    const text = ctx.reply.mock.calls[0][0] as string
    expect(text).toContain("💼 Your TipSwap Wallet")
    expect(text).toContain("EQDabc123")
    expect(text).toContain("2.5")
    expect(text).toContain("TON")
    expect(text).toContain("TON Mainnet")
    expect(text).toContain("USDT") // default_recv_token
  })

  it("replies with error when user lookup fails", async () => {
    ;(getOrCreateUser as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Supabase connection failed"),
    )

    const ctx = makeCtx({ command: "wallet" })
    await handler(ctx)

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Wallet lookup failed"),
    )
  })
})

// ─── /balance message format ──────────────────────────────────────

describe("/balance — message format", () => {
  let handler: Handler

  beforeEach(() => {
    getBot()
    handler = getRegisteredHandlers().get("balance")!

    ;(getOrCreateUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1", tg_id: 12345, tg_username: "testuser", first_name: "Test", default_recv_token: "USDT" },
      wallet: { id: "wallet-1", user_id: "user-1", address: "EQDabc123", public_key: "0x...", encrypted_mnemonic: "..." },
      created: false,
    })

    getBalance.mockResolvedValue(5_000_000_000n) // 5 TON
    getJettonBalance.mockImplementation((_addr: string, minter: string) => {
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
    ;(getOrCreateUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1", tg_id: 12345, tg_username: "testuser", first_name: "Test", default_recv_token: "USDT" },
      wallet: { id: "wallet-1", user_id: "user-1", address: "EQDabc123", public_key: "0x...", encrypted_mnemonic: "..." },
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
  })

  it("replies with welcome back message for returning users", async () => {
    ;(getOrCreateUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user-1", tg_id: 12345, tg_username: "testuser", first_name: "Test", default_recv_token: "USDT" },
      wallet: { id: "wallet-1", user_id: "user-1", address: "EQDabc123", public_key: "0x...", encrypted_mnemonic: "..." },
      created: false,
    })

    const ctx = makeCtx({ command: "start" })
    await handler(ctx)

    const text = ctx.reply.mock.calls[0][0] as string
    expect(text).toContain("👋 Welcome back")
    expect(text).toContain("EQDabc123")
    expect(text).toContain("/balance, /wallet, /swap, or /help")
  })

  it("does not reply when ctx.from is missing", async () => {
    const ctx = { ...makeCtx({ command: "start" }), from: undefined } as unknown as Ctx
    await handler(ctx)
    expect(ctx.reply).not.toHaveBeenCalled()
  })
})
