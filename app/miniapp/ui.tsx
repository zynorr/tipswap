"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  TonConnectButton,
  TonConnectUIProvider,
  useTonAddress,
  useTonConnectModal,
  useTonConnectUI,
} from "@tonconnect/ui-react"
import {
  Check,
  Clipboard,
  History,
  Loader2,
  Send,
  Settings,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string
        initDataUnsafe?: { start_param?: string }
        ready: () => void
        expand: () => void
        close: () => void
        MainButton?: {
          hide: () => void
        }
      }
    }
  }
}

type WalletRow = {
  id: string
  address: string
  mode: "managed" | "external"
  is_active: boolean
}

type MeResponse = {
  ok: true
  telegram: { id: number; username?: string; first_name?: string }
  user: { tg_username: string | null; default_recv_token: string }
  wallet: WalletRow
  network: string
}

type BalancesResponse = {
  ok: true
  balances: Record<"TON" | "USDT" | "STON", string>
}

type TipSummary = {
  id: string
  status: string
  offerToken: string
  askToken: string
  askAmount: string
  quotedOfferAmount: string | null
  recipientAddress: string
  txHash: string | null
  expiresAt: string
}

type ClaimSummary = {
  code: string
  status: string
  targetUsername: string
  askAmount: string
  askToken: string
  miniAppLink: string
}

type QuoteResponse =
  | {
      ok: true
      type: "quote"
      tip: TipSummary
      recipient: { username: string; address: string }
      quote: {
        offerSymbol: string
        askSymbol: string
        quotedOfferAmount: string
        expectedOut: string
        routerVersion: string
      }
    }
  | {
      ok: true
      type: "external"
      provider: "tonpay" | "stonfi"
      tip: TipSummary
      payment: {
        id: string
        tipId: string
        provider: string
        status: string
        reference: string | null
        txHash: string | null
        traceId: string | null
        error: string | null
      }
      message: { address: string; amount: string; payload?: string }
      recipient: { username: string; address: string }
      quote: {
        offerSymbol: string
        askSymbol: string
        quotedOfferAmount: string
        expectedOut: string
        routerVersion: string
      }
    }
  | { ok: true; type: "claim"; claim: ClaimSummary }

type ExternalSubmitResponse = {
  ok: true
  tip: TipSummary
  payment: {
    id: string
    tipId: string
    provider: string
    status: string
    reference: string | null
    txHash: string | null
    traceId: string | null
    error: string | null
  }
}

type TonPayStatusResponse = {
  ok: true
  payment: ExternalSubmitResponse["payment"]
  tip: TipSummary | null
  transfer: {
    status: string
    reference: string
    txHash: string
    traceId: string
    errorMessage?: string
  }
}

type HistoryResponse = {
  ok: true
  tips: TipSummary[]
  claims: ClaimSummary[]
  swaps: Array<{ id: string; status: string; offer_token: string; ask_token: string; offer_amount: string }>
}

const TOKENS = ["TON", "USDT", "STON"] as const
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "tipswapperbot"

function getInitData() {
  if (typeof window === "undefined") return ""
  const fromBridge = window.Telegram?.WebApp?.initData
  if (fromBridge) return fromBridge

  const candidates = [
    window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash,
    window.location.search.startsWith("?") ? window.location.search.slice(1) : window.location.search,
  ]

  for (const candidate of candidates) {
    const params = new URLSearchParams(candidate)
    const raw = params.get("tgWebAppData")
    if (raw) return raw
  }

  return ""
}

function getClaimCodeFromUrl() {
  if (typeof window === "undefined") return ""
  const url = new URL(window.location.href)
  const directClaim = url.searchParams.get("claim")
  if (directClaim) return directClaim
  const bridgeClaim = window.Telegram?.WebApp?.initDataUnsafe?.start_param?.replace(/^claim_/, "")
  if (bridgeClaim) return bridgeClaim

  const candidates = [
    window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash,
    window.location.search.startsWith("?") ? window.location.search.slice(1) : window.location.search,
  ]
  for (const candidate of candidates) {
    const params = new URLSearchParams(candidate)
    const startParam = params.get("tgWebAppStartParam")
    if (startParam) return startParam.replace(/^claim_/, "")
  }

  return ""
}

function manifestUrl() {
  if (typeof window === "undefined") return "/tonconnect-manifest.json"
  return `${window.location.origin}/tonconnect-manifest.json`
}

async function api<T>(path: string, initData: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-telegram-init-data": initData,
      ...(init?.headers ?? {}),
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.ok) throw new Error(json.error ?? "Request failed")
  return json as T
}

function shortAddress(address: string) {
  return address.length > 16 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address
}

function MiniAppInner() {
  const [initData, setInitData] = useState("")
  const [claimCode, setClaimCode] = useState("")
  const [booting, setBooting] = useState(false)
  const [tab, setTab] = useState<"wallet" | "send" | "claim" | "history" | "settings">("wallet")
  const [me, setMe] = useState<MeResponse | null>(null)
  const [balances, setBalances] = useState<BalancesResponse["balances"] | null>(null)
  const [history, setHistory] = useState<HistoryResponse | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [manualAddress, setManualAddress] = useState("")
  const [sendForm, setSendForm] = useState({ recipient: "", amount: "", ask: "USDT", offer: "TON" })
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const tonAddress = useTonAddress(true)
  const modal = useTonConnectModal()
  const [tonConnectUI] = useTonConnectUI()

  const authed = Boolean(initData)

  const refresh = useCallback(async () => {
    if (!initData) return
    setLoading(true)
    setError("")
    try {
      const [nextMe, nextBalances, nextHistory] = await Promise.all([
        api<MeResponse>("/api/miniapp/me", initData),
        api<BalancesResponse>("/api/miniapp/balances", initData),
        api<HistoryResponse>("/api/miniapp/history", initData),
      ])
      setMe(nextMe)
      setBalances(nextBalances.balances)
      setHistory(nextHistory)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [initData])

  useEffect(() => {
    let attempts = 0
    let cancelled = false

    const boot = () => {
      try {
        if (cancelled) return
        const webApp = window.Telegram?.WebApp
        webApp?.ready()
        webApp?.expand()
        webApp?.MainButton?.hide()

        const data = getInitData()
        if (data || attempts >= 20) {
          setInitData(data)
          const code = getClaimCodeFromUrl()
          setClaimCode(code)
          if (code) setTab("claim")
          return
        }

        attempts++
        window.setTimeout(boot, 150)
      } catch (err) {
        console.error("[tipswap] miniapp boot failed:", err)
      }
    }

    boot()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function connectAddress(address: string) {
    if (!address) return
    setLoading(true)
    setError("")
    try {
      await api("/api/miniapp/wallet/connect", initData, {
        method: "POST",
        body: JSON.stringify({ address }),
      })
      setManualAddress("")
      setMessage("External wallet connected.")
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function switchManaged() {
    setLoading(true)
    setError("")
    try {
      await api("/api/miniapp/wallet/managed", initData, { method: "POST", body: "{}" })
      setMessage("Managed wallet active.")
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function prepareClaim() {
    if (!claimCode) return
    setLoading(true)
    setError("")
    try {
      const result = await api<{ ok: true; alreadyPrepared: boolean; claim: ClaimSummary; tip: TipSummary | null }>(
        `/api/miniapp/claims/${encodeURIComponent(claimCode)}/prepare`,
        initData,
        { method: "POST", body: "{}" },
      )
      setMessage(result.alreadyPrepared ? "Claim is already waiting for sender confirmation." : "Claim ready. Sender can confirm now.")
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function createQuote() {
    setLoading(true)
    setError("")
    setQuote(null)
    try {
      const result = await api<QuoteResponse>("/api/miniapp/tips/quote", initData, {
        method: "POST",
        body: JSON.stringify({ ...sendForm, senderAddress: tonAddress }),
      })
      setQuote(result)
      setMessage(result.type === "claim" ? "Recipient needs to claim first." : "Quote ready for confirmation.")
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function confirmTip(tipId: string) {
    setLoading(true)
    setError("")
    try {
      await api(`/api/miniapp/tips/${tipId}/confirm`, initData, { method: "POST", body: "{}" })
      setMessage("Tip processed.")
      setQuote(null)
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function pollTonPay(reference: string) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const result = await api<TonPayStatusResponse>(
        `/api/miniapp/tonpay/${encodeURIComponent(reference)}`,
        initData,
      )
      if (result.transfer.status !== "pending") return result
      await new Promise((resolve) => window.setTimeout(resolve, 1500))
    }
    throw new Error("Payment submitted but confirmation is still pending. Check history shortly.")
  }

  async function confirmExternalTip(result: Extract<QuoteResponse, { type: "external" }>) {
    if (!tonAddress) {
      modal.open()
      return
    }
    setLoading(true)
    setError("")
    try {
      setMessage(result.provider === "tonpay" ? "Waiting for wallet signature..." : "Waiting for swap signature...")
      const txResult = await tonConnectUI.sendTransaction({
        messages: [result.message],
        validUntil: Math.floor(Date.now() / 1000) + 300,
        from: tonAddress,
      })

      const submitted = await api<ExternalSubmitResponse>(
        `/api/miniapp/tips/${result.tip.id}/external-submit`,
        initData,
        {
          method: "POST",
          body: JSON.stringify({ boc: txResult.boc }),
        },
      )

      if (result.provider === "tonpay" && submitted.payment.reference) {
        setMessage("Payment submitted. Waiting for TON Pay confirmation...")
        const status = await pollTonPay(submitted.payment.reference)
        setMessage(status.transfer.status === "success" ? "Tip confirmed." : status.transfer.errorMessage ?? "Payment failed.")
      } else {
        setMessage("Swap submitted. Tip is marked as sending while the transaction settles.")
      }

      setQuote(null)
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const connectedWalletDifferent = useMemo(() => {
    if (!tonAddress || !me?.wallet.address) return false
    return tonAddress !== me.wallet.address
  }, [tonAddress, me?.wallet.address])

  if (!authed) {
    return (
      <main className="min-h-screen bg-background px-5 py-8 text-foreground">
        <section className="mx-auto max-w-md rounded-lg border bg-card p-5">
          <h1 className="text-xl font-semibold">{booting ? "Opening TipSwap" : "Open in Telegram"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This Mini App needs Telegram authentication. Open it from @{BOT_USERNAME}.
          </p>
          <a
            className="mt-4 inline-flex rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            href={`https://t.me/${BOT_USERNAME}?startapp=miniapp`}
          >
            Open @{BOT_USERNAME}
          </a>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground">TipSwap</p>
            <h1 className="text-2xl font-semibold">Wallet</h1>
            <p className="text-sm text-muted-foreground">@{me?.telegram.username ?? me?.user.tg_username ?? "telegram"}</p>
          </div>
          <Badge variant="secondary">{me?.network ?? "TON"}</Badge>
        </header>

        {(message || error) && (
          <div className={cn("rounded-md border px-3 py-2 text-sm", error ? "border-destructive text-destructive" : "border-primary/40 text-primary")}>
            {error || message}
          </div>
        )}

        <nav className="grid grid-cols-5 rounded-lg border bg-card p-1">
          {[
            ["wallet", Wallet],
            ["send", Send],
            ["claim", Check],
            ["history", History],
            ["settings", Settings],
          ].map(([key, Icon]) => (
            <button
              key={key as string}
              onClick={() => setTab(key as typeof tab)}
              className={cn(
                "flex h-10 items-center justify-center rounded-md text-muted-foreground",
                tab === key && "bg-secondary text-foreground",
              )}
              type="button"
            >
              <Icon className="size-4" />
            </button>
          ))}
        </nav>

        {tab === "wallet" && (
          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Active wallet</p>
                <p className="font-medium">{me?.wallet.mode ?? "..."}</p>
              </div>
              <Badge>{me?.wallet.mode ?? "loading"}</Badge>
            </div>
            <div className="mt-3 rounded-md bg-secondary p-3 font-mono text-xs">
              {me?.wallet.address ?? "Loading..."}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {TOKENS.map((token) => (
                <div key={token} className="rounded-md border p-2">
                  <p className="text-xs text-muted-foreground">{token}</p>
                  <p className="truncate text-sm font-medium">{balances?.[token] ?? "..."}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <TonConnectButton />
              {connectedWalletDifferent && (
                <Button onClick={() => connectAddress(tonAddress)} disabled={loading}>
                  Save connected wallet
                </Button>
              )}
              <div className="flex gap-2">
                <Input
                  value={manualAddress}
                  onChange={(event) => setManualAddress(event.target.value)}
                  placeholder="Paste UQ... address"
                />
                <Button size="icon" onClick={() => connectAddress(manualAddress)} disabled={loading}>
                  <Clipboard className="size-4" />
                </Button>
              </div>
              <Button variant="secondary" onClick={switchManaged} disabled={loading}>
                Use managed wallet
              </Button>
            </div>
          </section>
        )}

        {tab === "send" && (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-lg font-semibold">Send a tip</h2>
            <div className="mt-3 flex flex-col gap-2">
              <Input placeholder="@alice" value={sendForm.recipient} onChange={(e) => setSendForm({ ...sendForm, recipient: e.target.value })} />
              <Input placeholder="5" value={sendForm.amount} onChange={(e) => setSendForm({ ...sendForm, amount: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <select className="h-9 rounded-md border bg-background px-3 text-sm" value={sendForm.ask} onChange={(e) => setSendForm({ ...sendForm, ask: e.target.value })}>
                  {TOKENS.map((token) => <option key={token}>{token}</option>)}
                </select>
                <select className="h-9 rounded-md border bg-background px-3 text-sm" value={sendForm.offer} onChange={(e) => setSendForm({ ...sendForm, offer: e.target.value })}>
                  {TOKENS.map((token) => <option key={token}>{token}</option>)}
                </select>
              </div>
              <Button onClick={createQuote} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Quote
              </Button>
            </div>
            {quote?.type === "quote" && (
              <div className="mt-4 rounded-md border p-3 text-sm">
                <p>Recipient: @{quote.recipient.username}</p>
                <p>They receive: {quote.tip.askAmount} {quote.tip.askToken}</p>
                <p>You pay: {quote.quote.quotedOfferAmount} {quote.quote.offerSymbol}</p>
                <Button className="mt-3 w-full" onClick={() => confirmTip(quote.tip.id)} disabled={loading}>
                  Confirm and send
                </Button>
              </div>
            )}
            {quote?.type === "external" && (
              <div className="mt-4 rounded-md border p-3 text-sm">
                <p>Recipient: @{quote.recipient.username}</p>
                <p>They receive: {quote.tip.askAmount} {quote.tip.askToken}</p>
                <p>You pay: {quote.quote.quotedOfferAmount} {quote.quote.offerSymbol}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {quote.provider === "tonpay" ? "Direct payment via TON Pay" : `Swap route: STON.fi ${quote.quote.routerVersion}`}
                </p>
                <Button className="mt-3 w-full" onClick={() => confirmExternalTip(quote)} disabled={loading}>
                  Sign and send
                </Button>
              </div>
            )}
            {quote?.type === "claim" && (
              <div className="mt-4 rounded-md border p-3 text-sm">
                <p>@{quote.claim.targetUsername} needs to claim first.</p>
                <p className="mt-2 break-all font-mono text-xs">{quote.claim.miniAppLink}</p>
              </div>
            )}
          </section>
        )}

        {tab === "claim" && (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-lg font-semibold">Claim tip</h2>
            <p className="mt-1 text-sm text-muted-foreground">Connect or choose your receiving wallet, then prepare the claim.</p>
            <Input className="mt-3" placeholder="claim code" value={claimCode} onChange={(e) => setClaimCode(e.target.value)} />
            <Button className="mt-3 w-full" onClick={prepareClaim} disabled={loading || !claimCode}>
              Prepare claim
            </Button>
          </section>
        )}

        {tab === "history" && (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-lg font-semibold">History</h2>
            <div className="mt-3 flex flex-col gap-2">
              {history?.tips?.map((tip) => (
                <div key={tip.id} className="rounded-md border p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span>{tip.askAmount} {tip.askToken}</span>
                    <Badge variant="secondary">{tip.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{shortAddress(tip.recipientAddress)}</p>
                </div>
              ))}
              {history?.claims?.map((claim) => (
                <div key={claim.code} className="rounded-md border p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span>@{claim.targetUsername}</span>
                    <Badge variant="outline">{claim.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{claim.askAmount} {claim.askToken}</p>
                </div>
              ))}
              {!history?.tips?.length && !history?.claims?.length && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-lg font-semibold">Settings</h2>
            <div className="mt-3 space-y-2 text-sm">
              <p>Receive token: <b>{me?.user.default_recv_token ?? "USDT"}</b></p>
              <p>Managed wallet sends bot-signed swaps and tips. External wallets receive tips.</p>
              <Button variant="secondary" onClick={refresh} disabled={loading}>Refresh</Button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

export function MiniAppClient() {
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl()}>
      <MiniAppInner />
    </TonConnectUIProvider>
  )
}
