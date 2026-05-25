import { describe, it, expect, vi, beforeEach } from "vitest"
import { Address, toNano, beginCell } from "@ton/core"

// ---- Mock dependencies before any imports ----

vi.mock("@/lib/wallet/ton", () => ({
  getBalance: vi.fn(),
  getJettonBalance: vi.fn(),
  getTonClient: vi.fn(),
  getNetwork: vi.fn(() => "mainnet"),
  getNetworkDisplay: vi.fn(() => "TON Mainnet"),
  sendInternalMessage: vi.fn(),
  sendTonTransfer: vi.fn(),
}))

// We need a mock CPIRouterV2_2 that returns tx params and pool data
const mockGetPool = vi.fn()
const mockGetPoolData = vi.fn()
const mockGetSwapTonToJettonTxParams = vi.fn()
const mockGetSwapJettonToTonTxParams = vi.fn()
const mockGetSwapJettonToJettonTxParams = vi.fn()
const mockSimulateSwap = vi.fn()
const mockSimulateReverseSwap = vi.fn()

vi.mock("@ston-fi/api", () => ({
  StonApiClient: vi.fn(function StonApiClient() {
    return {
      simulateSwap: mockSimulateSwap,
      simulateReverseSwap: mockSimulateReverseSwap,
    }
  }),
}))

vi.mock("@ston-fi/sdk", () => ({
  dexFactory: vi.fn(() => ({
    pTON: {
      create: vi.fn(() => ({ address: mockAddress })),
    },
  })),
  routerFactory: vi.fn(() => ({
    getPool: mockGetPool,
    getSwapTonToJettonTxParams: mockGetSwapTonToJettonTxParams,
    getSwapJettonToTonTxParams: mockGetSwapJettonToTonTxParams,
    getSwapJettonToJettonTxParams: mockGetSwapJettonToJettonTxParams,
  })),
  pTON: {
    v2_1: {
      create: vi.fn(() => ({ address: mockAddress })),
    },
  },
}))

// Now import the modules under test
import {
  executeSwap,
  executeTipSwap,
  quoteTipSwap,
  SwapUserError,
  toRawAmount,
} from "@/lib/ston/swap"
import * as ton from "@/lib/wallet/ton"

// Use the production router address (valid checksum)
const mockAddress = Address.parse("EQD11suHkrO_1Mb5IIdYFx5ZPy38MuHoeHx6dA-QRaD8w0UJ")

beforeEach(() => {
  vi.clearAllMocks()

  // Default mock client
  ;(ton.getTonClient as ReturnType<typeof vi.fn>).mockReturnValue({
    open: (x: unknown) => x,
    provider: () => ({
      runMethod: vi.fn(),
    }),
  })

  // Default: user has 10 TON
  ;(ton.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(toNano("10"))
  ;(ton.getJettonBalance as ReturnType<typeof vi.fn>).mockResolvedValue(1_000_000_000_000n)

  // Default tx params
  const defaultTxParams = {
    to: mockAddress,
    value: toNano("0.25"),
    body: beginCell().storeUint(0, 32).endCell(),
  }

  mockGetSwapTonToJettonTxParams.mockResolvedValue(defaultTxParams)
  mockGetSwapJettonToTonTxParams.mockResolvedValue(defaultTxParams)
  mockGetSwapJettonToJettonTxParams.mockResolvedValue(defaultTxParams)

  mockSimulateSwap.mockResolvedValue({
    askUnits: "286209",
    minAskUnits: "283346",
    recommendedMinAskUnits: "283346",
    offerUnits: "500000000",
    offerAddress: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
    askAddress: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
    offerJettonWallet: "EQBofferWallet000000000000000000000000000000000000000",
    askJettonWallet: "EQBaskWallet00000000000000000000000000000000000000000",
    poolAddress: "EQBpool0000000000000000000000000000000000000000000000",
    routerAddress: mockAddress.toString(),
    router: {
      address: mockAddress.toString(),
      majorVersion: 2,
      minorVersion: 2,
      ptonMasterAddress: "EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S",
      ptonWalletAddress: "EQBptonWallet0000000000000000000000000000000000000000",
      ptonVersion: "2.1",
      routerType: "ConstantProduct",
      poolCreationEnabled: true,
    },
    gasParams: {
      gasBudget: "300000000",
      forwardGas: "300000000",
      estimatedGasConsumption: "50000000",
    },
    feeAddress: "",
    feePercent: "0",
    feeUnits: "0",
    priceImpact: "0",
    slippageTolerance: "0.01",
    swapRate: "0.572418",
    recommendedSlippageTolerance: "0.01",
  })
  mockSimulateReverseSwap.mockResolvedValue({
    askUnits: "5000000",
    minAskUnits: "4950000",
    recommendedMinAskUnits: "4950000",
    offerUnits: "2500000000",
    offerAddress: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
    askAddress: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
    offerJettonWallet: "EQBofferWallet000000000000000000000000000000000000000",
    askJettonWallet: "EQBaskWallet00000000000000000000000000000000000000000",
    poolAddress: "EQBpool0000000000000000000000000000000000000000000000",
    routerAddress: mockAddress.toString(),
    router: {
      address: mockAddress.toString(),
      majorVersion: 2,
      minorVersion: 2,
      ptonMasterAddress: "EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S",
      ptonWalletAddress: "EQBptonWallet0000000000000000000000000000000000000000",
      ptonVersion: "2.1",
      routerType: "ConstantProduct",
      poolCreationEnabled: true,
    },
    gasParams: {
      gasBudget: "300000000",
      forwardGas: "300000000",
      estimatedGasConsumption: "50000000",
    },
    feeAddress: "",
    feePercent: "0",
    feeUnits: "0",
    priceImpact: "0",
    slippageTolerance: "0.01",
    swapRate: "2",
    recommendedSlippageTolerance: "0.01",
  })

  // Default: TON→USDT pool with 30 bps fee and reasonable reserves
  mockGetPool.mockResolvedValue({
    address: mockAddress,
    getPoolData: mockGetPoolData,
  })
  mockGetPoolData.mockResolvedValue({
    reserve0: toNano("1000"),   // 1000 TON in pool
    reserve1: 1_000_000_000_000n,   // 1M USDT in pool (6 decimals = 10^12 raw)
    lpFee: 25n,
    protocolFee: 5n,
  })

  // Default: successful broadcast
  ;(ton.sendInternalMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
    sent: true,
    seqno: 42,
  })
  ;(ton.sendTonTransfer as ReturnType<typeof vi.fn>).mockResolvedValue({
    sent: true,
    seqno: 43,
  })
})

// ─── Preflight tests ──────────────────────────────────────────────

describe("executeSwap — preflight", () => {
  it("throws SwapUserError when TON balance is insufficient", async () => {
    ;(ton.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(toNano("0.1"))

    await expect(
      executeSwap({
        mnemonic: "abandon abandon ...",
        userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
        offer: "TON",
        ask: "USDT",
        offerAmount: "0.5",
      }),
    ).rejects.toThrow(SwapUserError)
  })

  it("includes required amounts in the error message for TON offers", async () => {
    ;(ton.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(toNano("0.1"))

    try {
      await executeSwap({
        mnemonic: "abandon abandon ...",
        userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
        offer: "TON",
        ask: "USDT",
        offerAmount: "0.5",
      })
    } catch (e) {
      const msg = (e as SwapUserError).message
      expect(msg).toContain("Insufficient TON balance")
      expect(msg).toContain("Swap amount:")
      expect(msg).toContain("Gas (STON.fi):")
      expect(msg).toContain("Safety buffer:")
    }
  })

  it("includes required amounts in the error message for Jetton offers", async () => {
    ;(ton.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(toNano("0.1"))

    try {
      await executeSwap({
        mnemonic: "abandon abandon ...",
        userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
        offer: "USDT",
        ask: "TON",
        offerAmount: "10",
      })
    } catch (e) {
      const msg = (e as SwapUserError).message
      expect(msg).toContain("Insufficient TON balance")
      expect(msg).not.toContain("Swap amount:") // no offerPart since offer is not TON
      expect(msg).toContain("Gas (STON.fi):")
      expect(msg).toContain("Safety buffer:")
    }
  })

  it("throws SwapUserError when jetton offer balance is insufficient", async () => {
    ;(ton.getJettonBalance as ReturnType<typeof vi.fn>).mockResolvedValue(1_000_000n)

    await expect(
      executeSwap({
        mnemonic: "abandon abandon ...",
        userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
        offer: "USDT",
        ask: "TON",
        offerAmount: "10",
      }),
    ).rejects.toThrow(/Insufficient USDT balance/)

    expect(mockGetSwapJettonToTonTxParams).not.toHaveBeenCalled()
  })
})

// ─── Route selection tests ────────────────────────────────────────

describe("executeSwap — route selection", () => {
  const validParams = {
    mnemonic: "abandon abandon ...",
    userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
  }

  it("calls getSwapTonToJettonTxParams for TON→Jetton", async () => {
    await executeSwap({ ...validParams, offer: "TON", ask: "USDT", offerAmount: "0.5" })
    expect(mockGetSwapTonToJettonTxParams).toHaveBeenCalledOnce()
    expect(mockGetSwapJettonToTonTxParams).not.toHaveBeenCalled()
    expect(mockGetSwapJettonToJettonTxParams).not.toHaveBeenCalled()
  })

  it("calls getSwapJettonToTonTxParams for Jetton→TON", async () => {
    await executeSwap({ ...validParams, offer: "USDT", ask: "TON", offerAmount: "5" })
    expect(mockGetSwapJettonToTonTxParams).toHaveBeenCalledOnce()
    expect(mockGetSwapTonToJettonTxParams).not.toHaveBeenCalled()
    expect(mockGetSwapJettonToJettonTxParams).not.toHaveBeenCalled()
  })

  it("calls getSwapJettonToJettonTxParams for Jetton→Jetton", async () => {
    await executeSwap({ ...validParams, offer: "USDT", ask: "STON", offerAmount: "5" })
    expect(mockGetSwapJettonToJettonTxParams).toHaveBeenCalledOnce()
    expect(mockGetSwapTonToJettonTxParams).not.toHaveBeenCalled()
    expect(mockGetSwapJettonToTonTxParams).not.toHaveBeenCalled()
  })

  it("rejects same-token swaps before building tx params", async () => {
    await expect(
      executeSwap({ ...validParams, offer: "TON", ask: "TON", offerAmount: "0.5" }),
    ).rejects.toThrow(SwapUserError)

    expect(mockGetSwapTonToJettonTxParams).not.toHaveBeenCalled()
    expect(mockGetSwapJettonToTonTxParams).not.toHaveBeenCalled()
    expect(mockGetSwapJettonToJettonTxParams).not.toHaveBeenCalled()
  })
})

// ─── Success path ─────────────────────────────────────────────────

describe("executeSwap — success path", () => {
  it("returns sent=true, seqno, expectedOut, offerRaw, and network", async () => {
    const result = await executeSwap({
      mnemonic: "abandon abandon ...",
      userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
      offer: "TON",
      ask: "USDT",
      offerAmount: "0.5",
    })

    expect(result.sent).toBe(true)
    expect(result.seqno).toBe(42)
    expect(result.network).toBe("mainnet")
    expect(result.offerRaw).toBe(toRawAmount("0.5", 9).toString())
    expect(typeof result.expectedOut).toBe("string")
    expect(typeof result.expectedRaw).toBe("string")
    expect(typeof result.minAskAmount).toBe("string")
    expect(result.expectedRaw).toBe("286209")
    expect(result.minAskAmount).toBe("283346")
    // The swap broadcasts after getting the quote
    expect(ton.sendInternalMessage).toHaveBeenCalledOnce()
  })

  it("passes caller-provided minAskAmount through to STON.fi", async () => {
    await executeSwap({
      mnemonic: "abandon abandon ...",
      userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
      offer: "TON",
      ask: "USDT",
      offerAmount: "0.5",
      minAskAmount: 12345n,
    })

    expect(mockGetSwapTonToJettonTxParams).toHaveBeenCalledWith(
      expect.objectContaining({ minAskAmount: 12345n }),
    )
  })

  it("broadcasts the transaction after building params", async () => {
    const result = await executeSwap({
      mnemonic: "abandon abandon ...",
      userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
      offer: "STON",
      ask: "USDT",
      offerAmount: "10",
    })

    expect(result.sent).toBe(true)
    // Should have called the correct route builder
    expect(mockGetSwapJettonToJettonTxParams).toHaveBeenCalledOnce()
    // sendInternalMessage should receive to, value, body, and mnemonic
    const sentCall = (ton.sendInternalMessage as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(sentCall).toHaveProperty("mnemonic")
    expect(sentCall).toHaveProperty("to")
    expect(sentCall).toHaveProperty("value")
    expect(sentCall).toHaveProperty("body")
  })
})

// ─── STON.fi simulation quote ─────────────────────────────────────

describe("executeSwap — quote simulation", () => {
  it("fails safely when a live quote cannot be fetched", async () => {
    mockSimulateSwap.mockRejectedValue(new Error("STON.fi API unavailable"))

    await expect(
      executeSwap({
        mnemonic: "abandon abandon ...",
        userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
        offer: "TON",
        ask: "USDT",
        offerAmount: "0.5",
      }),
    ).rejects.toThrow(SwapUserError)

    expect(ton.sendInternalMessage).not.toHaveBeenCalled()
  })

  it("fails safely when the quote returns zero output", async () => {
    mockSimulateSwap.mockResolvedValue({
      askUnits: "0",
      minAskUnits: "0",
      recommendedMinAskUnits: "0",
    })

    await expect(
      executeSwap({
        mnemonic: "abandon abandon ...",
        userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
        offer: "TON",
        ask: "USDT",
        offerAmount: "0.5",
      }),
    ).rejects.toThrow(SwapUserError)
  })
})

// ─── Swap error handling ──────────────────────────────────────────

describe("executeSwap — error handling", () => {
  it("wraps insufficient balance errors from STON.fi SDK as SwapUserError", async () => {
    mockGetSwapTonToJettonTxParams.mockRejectedValue(
      new Error("insufficient TON balance"),
    )

    await expect(
      executeSwap({
        mnemonic: "abandon abandon ...",
        userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
        offer: "TON",
        ask: "USDT",
        offerAmount: "0.5",
      }),
    ).rejects.toThrow(SwapUserError)
  })

  it("re-throws unexpected errors from STON.fi SDK as-is", async () => {
    mockGetSwapTonToJettonTxParams.mockRejectedValue(
      new Error("some unexpected SDK error"),
    )

    await expect(
      executeSwap({
        mnemonic: "abandon abandon ...",
        userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
        offer: "TON",
        ask: "USDT",
        offerAmount: "0.5",
      }),
    ).rejects.toThrow("some unexpected SDK error")
  })
})

// ─── Direct recipient tipping ────────────────────────────────────

describe("tip swap — reverse quote and direct recipient execution", () => {
  const validTipParams = {
    mnemonic: "abandon abandon ...",
    senderAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
    recipientAddress: "UQA7f7c1zn0J08RKt8WPXcXlnZLAtcN22UsFdcvaQqYU8AS8",
    offer: "TON",
    ask: "USDT",
    askAmount: "5",
  }

  it("quotes exact-output tips with STON.fi reverse simulation and v2 only", async () => {
    const quote = await quoteTipSwap({
      offer: "TON",
      ask: "USDT",
      askAmount: "5",
    })

    expect(mockSimulateReverseSwap).toHaveBeenCalledWith(
      expect.objectContaining({
        offerAddress: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
        askAddress: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
        askUnits: "5000000",
        slippageTolerance: "0.01",
        dexV2: true,
        dexVersion: [2],
      }),
    )
    expect(quote.offerSymbol).toBe("TON")
    expect(quote.askSymbol).toBe("USDT")
    expect(quote.quotedOfferAmount).toBe("2.5000")
    expect(quote.expectedOut).toBe("5.0000")
    expect(quote.routerVersion).toBe("v2.2")
  })

  it("quotes same-token TON tips as direct transfers without STON.fi", async () => {
    const quote = await quoteTipSwap({
      offer: "TON",
      ask: "TON",
      askAmount: "0.1",
    })

    expect(mockSimulateReverseSwap).not.toHaveBeenCalled()
    expect(quote.offerSymbol).toBe("TON")
    expect(quote.askSymbol).toBe("TON")
    expect(quote.quotedOfferAmount).toBe("0.1000")
    expect(quote.expectedOut).toBe("0.1000")
    expect(quote.routerVersion).toBe("direct")
  })

  it("executes same-token TON tips as direct wallet transfers", async () => {
    const result = await executeTipSwap({
      ...validTipParams,
      offer: "TON",
      ask: "TON",
      askAmount: "0.1",
    })

    expect(ton.sendTonTransfer).toHaveBeenCalledWith({
      mnemonic: validTipParams.mnemonic,
      to: validTipParams.recipientAddress,
      amount: 100_000_000n,
    })
    expect(mockGetSwapTonToJettonTxParams).not.toHaveBeenCalled()
    expect(result.expectedOut).toBe("0.1000")
  })

  it("passes receiverAddress to the v2 router for direct delivery", async () => {
    await executeTipSwap(validTipParams)

    expect(mockGetSwapTonToJettonTxParams).toHaveBeenCalledWith(
      expect.objectContaining({
        userWalletAddress: validTipParams.senderAddress,
        receiverAddress: validTipParams.recipientAddress,
        offerAmount: 2_500_000_000n,
        minAskAmount: 4_950_000n,
      }),
    )
    expect(ton.sendInternalMessage).toHaveBeenCalledOnce()
  })

  it("rejects direct tipping when STON.fi returns a non-v2 router", async () => {
    mockSimulateReverseSwap.mockResolvedValue({
      askUnits: "5000000",
      minAskUnits: "4950000",
      recommendedMinAskUnits: "4950000",
      offerUnits: "2500000000",
      router: {
        address: mockAddress.toString(),
        majorVersion: 1,
        minorVersion: 0,
        ptonMasterAddress: "EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S",
        ptonWalletAddress: "EQBptonWallet0000000000000000000000000000000000000000",
        ptonVersion: "1.0",
        routerType: "ConstantProduct",
        poolCreationEnabled: true,
      },
      gasParams: {
        forwardGas: "300000000",
        estimatedGasConsumption: "50000000",
      },
    })

    await expect(
      quoteTipSwap({ offer: "TON", ask: "USDT", askAmount: "5" }),
    ).rejects.toThrow(SwapUserError)
    expect(mockGetSwapTonToJettonTxParams).not.toHaveBeenCalled()
  })

  it("preflights the quoted offer amount plus simulated gas", async () => {
    ;(ton.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(toNano("2.6"))

    await expect(executeTipSwap(validTipParams)).rejects.toThrow(
      /Insufficient TON balance/,
    )
    expect(mockGetSwapTonToJettonTxParams).not.toHaveBeenCalled()
  })
})
