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
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Clipboard,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  Send,
  Settings,
  Wallet,
  XCircle,
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
      recipient: { username: string; address: string; receiveToken: string; usedPreference: boolean }
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
      recipient: { username: string; address: string; receiveToken: string; usedPreference: boolean }
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

type ActivityItem = {
  id: string
  kind: "tip" | "swap" | "claim"
  direction: "sent" | "received"
  status: string
  title: string
  primaryAmount: string
  secondaryAmount: string | null
  route: string
  source: string
  recipientAddress: string | null
  txHash: string | null
  error: string | null
  createdAt: string
  updatedAt: string
  expiresAt: string | null
  externalPayment: {
    id: string
    provider: "tonpay" | "stonfi"
    status: string
    reference: string | null
    txHash: string | null
    traceId: string | null
    error: string | null
    updatedAt: string
  } | null
  miniAppLink?: string
}

type HistoryResponse = {
  ok: true
  tips: TipSummary[]
  claims: ClaimSummary[]
  swaps: Array<{ id: string; status: string; offer_token: string; ask_token: string; offer_amount: string }>
  activity: ActivityItem[]
}

const TOKENS = ["TON", "USDT", "STON"] as const
const RECEIVE_OPTIONS = ["AUTO", ...TOKENS] as const
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "tipswapperbot"
const TONSCAN_URL = "https://tonscan.org"

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
  if (directClaim) return normalizeClaimInput(directClaim)
  const bridgeClaim = window.Telegram?.WebApp?.initDataUnsafe?.start_param?.replace(/^claim_/, "")
  if (bridgeClaim) return normalizeClaimInput(bridgeClaim)

  const candidates = [
    window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash,
    window.location.search.startsWith("?") ? window.location.search.slice(1) : window.location.search,
  ]
  for (const candidate of candidates) {
    const params = new URLSearchParams(candidate)
    const startParam = params.get("tgWebAppStartParam")
    if (startParam) return normalizeClaimInput(startParam)
  }

  return ""
}

function normalizeClaimInput(input: string | null | undefined) {
  const raw = input?.trim() ?? ""
  if (!raw) return ""

  try {
    const url = new URL(raw)
    return normalizeClaimInput(
      url.searchParams.get("claim") ??
      url.searchParams.get("start") ??
      url.searchParams.get("startapp") ??
      url.searchParams.get("tgWebAppStartParam") ??
      url.hash.replace(/^#/, ""),
    )
  } catch {
    return decodeURIComponent(raw).replace(/^claim_/, "")
  }
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return ""
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function statusTone(status: string) {
  if (["sent", "success", "completed"].includes(status)) return "success"
  if (["failed", "cancelled", "expired", "error"].includes(status)) return "danger"
  if (["sending", "submitted", "pending", "quoted", "quoting"].includes(status)) return "pending"
  return "neutral"
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status)
  return (
    <Badge
      variant={tone === "danger" ? "destructive" : tone === "pending" ? "secondary" : "outline"}
      className={cn(
        "capitalize",
        tone === "success" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      )}
    >
      {tone === "success" && <CheckCircle2 className="size-3" />}
      {tone === "danger" && <XCircle className="size-3" />}
      {tone === "pending" && <Clock3 className="size-3" />}
      {status}
    </Badge>
  )
}

function ActivityCard({ item }: { item: ActivityItem }) {
  const txHash = item.externalPayment?.txHash ?? item.txHash
  const explorerHref = txHash ? `${TONSCAN_URL}/tx/${encodeURIComponent(txHash)}` : null
  return (
    <article className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md",
              item.direction === "received"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-primary/10 text-primary",
            )}
          >
            {item.direction === "received" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-1 text-sm">
              <span className="font-medium">{item.primaryAmount}</span>
              {item.secondaryAmount && <span className="text-muted-foreground"> · {item.secondaryAmount}</span>}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{item.route}</p>
          </div>
        </div>
        <time className="shrink-0 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</time>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="capitalize">{item.kind}</Badge>
        <Badge variant="outline" className="capitalize">{item.source}</Badge>
        {item.externalPayment && (
          <Badge variant="outline" className="uppercase">{item.externalPayment.provider}</Badge>
        )}
        {item.recipientAddress && <span className="font-mono">{shortAddress(item.recipientAddress)}</span>}
      </div>
      {item.error && (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {item.error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {explorerHref && (
          <Button asChild variant="secondary" size="sm">
            <a href={explorerHref} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3" />
              Explorer
            </a>
          </Button>
        )}
        {item.miniAppLink && (
          <Button asChild variant="secondary" size="sm">
            <a href={item.miniAppLink} target="_blank" rel="noreferrer">
              Claim link
            </a>
          </Button>
        )}
      </div>
    </article>
  )
}

type OperationStep = {
  label: string
  detail: string
  state: "pending" | "active" | "done" | "error"
}

function OperationPanel({
  title,
  detail,
  steps,
  error,
}: {
  title: string
  detail: string
  steps: OperationStep[]
  error?: string
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {error ? <AlertCircle className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {steps.map((step) => (
          <div key={step.label} className="flex gap-3 rounded-md border bg-background p-3">
            <div
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                step.state === "done" && "border-emerald-500 bg-emerald-500 text-white",
                step.state === "active" && "border-primary text-primary",
                step.state === "error" && "border-destructive bg-destructive text-white",
              )}
            >
              {step.state === "done" && <Check className="size-3" />}
              {step.state === "active" && <Loader2 className="size-3 animate-spin" />}
              {step.state === "error" && <XCircle className="size-3" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{step.label}</p>
              <p className="text-xs text-muted-foreground">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    </section>
  )
}

function MiniAppInner() {
  const [initData, setInitData] = useState("")
  const [claimCode, setClaimCode] = useState("")
  const [tab, setTab] = useState<"wallet" | "send" | "claim" | "history" | "settings">("wallet")
  const [me, setMe] = useState<MeResponse | null>(null)
  const [balances, setBalances] = useState<BalancesResponse["balances"] | null>(null)
  const [history, setHistory] = useState<HistoryResponse | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [walletAction, setWalletAction] = useState<"connect" | "managed" | null>(null)
  const [sendStage, setSendStage] = useState<
    "idle" | "quoting" | "quote-ready" | "claim-ready" | "confirming" | "wallet" | "submitting" | "polling" | "success" | "failed"
  >("idle")
  const [sendDetail, setSendDetail] = useState("")
  const [manualAddress, setManualAddress] = useState("")
  const [sendForm, setSendForm] = useState({ recipient: "", amount: "", ask: "AUTO", offer: "TON" })
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const tonAddress = useTonAddress(true)
  const modal = useTonConnectModal()
  const [tonConnectUI] = useTonConnectUI()

  const authed = Boolean(initData)
  const busy = refreshing || Boolean(walletAction) || !["idle", "quote-ready", "claim-ready", "success", "failed"].includes(sendStage)

  const refresh = useCallback(async () => {
    if (!initData) return
    setRefreshing(true)
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
      setRefreshing(false)
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
    setWalletAction("connect")
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
      setWalletAction(null)
    }
  }

  async function switchManaged() {
    setWalletAction("managed")
    setError("")
    try {
      await api("/api/miniapp/wallet/managed", initData, { method: "POST", body: "{}" })
      setMessage("Managed wallet active.")
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setWalletAction(null)
    }
  }

  async function prepareClaim() {
    if (!claimCode) return
    const normalizedClaimCode = normalizeClaimInput(claimCode)
    setSendStage("confirming")
    setSendDetail("Preparing this claim with your active receiving wallet.")
    setError("")
    try {
      const result = await api<{ ok: true; alreadyPrepared: boolean; claim: ClaimSummary; tip: TipSummary | null }>(
        `/api/miniapp/claims/${encodeURIComponent(normalizedClaimCode)}/prepare`,
        initData,
        { method: "POST", body: "{}" },
      )
      setMessage(result.alreadyPrepared ? "Claim is already waiting for sender confirmation." : "Claim ready. Sender can confirm now.")
      setSendStage("success")
      setSendDetail(result.alreadyPrepared ? "The sender can confirm the existing quote." : "The sender can now confirm this tip.")
      await refresh()
    } catch (err) {
      const nextError = (err as Error).message
      setError(nextError)
      setSendStage("failed")
      setSendDetail(nextError)
    } finally {
      // Stage carries the result state.
    }
  }

  async function createQuote() {
    if (me?.wallet.mode === "external" && !tonAddress) {
      const nextError = "Connect your saved external wallet before reviewing this quote."
      setSendStage("failed")
      setSendDetail(nextError)
      setMessage("")
      setError(nextError)
      setQuote(null)
      modal.open()
      return
    }

    setSendStage("quoting")
    setSendDetail("Checking recipient, balances, route, gas, and slippage.")
    setMessage("")
    setError("")
    setQuote(null)
    try {
      const result = await api<QuoteResponse>("/api/miniapp/tips/quote", initData, {
        method: "POST",
        body: JSON.stringify({ ...sendForm, senderAddress: tonAddress }),
      })
      setQuote(result)
      if (result.type === "claim") {
        setSendStage("claim-ready")
        setSendDetail(`@${result.claim.targetUsername} needs to open the claim link before funds move.`)
        setMessage("Recipient needs to claim first.")
      } else {
        setSendStage("quote-ready")
        setSendDetail(
          result.type === "external"
            ? "Review the quote, then sign the transaction in your wallet."
            : "Review the quote, then confirm from your managed wallet.",
        )
        setMessage("Quote ready for confirmation.")
      }
      await refresh()
    } catch (err) {
      const nextError = (err as Error).message
      setError(nextError)
      setSendStage("failed")
      setSendDetail(nextError)
    } finally {
      // Stage carries the result state.
    }
  }

  async function confirmTip(tipId: string) {
    setSendStage("confirming")
    setSendDetail("Submitting the managed wallet transaction and waiting for chain confirmation.")
    setError("")
    try {
      await api(`/api/miniapp/tips/${tipId}/confirm`, initData, { method: "POST", body: "{}" })
      setMessage("Tip sent.")
      setSendStage("success")
      setSendDetail("The tip was confirmed and history has been refreshed.")
      setQuote(null)
      await refresh()
    } catch (err) {
      const nextError = (err as Error).message
      setError(nextError)
      setSendStage("failed")
      setSendDetail(nextError)
    } finally {
      // Stage carries the result state.
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
      setSendStage("wallet")
      setSendDetail("Connect the wallet saved as your active external wallet, then return to sign.")
      modal.open()
      return
    }
    setSendStage("wallet")
    setSendDetail(result.provider === "tonpay" ? "Approve the TON Pay transfer in your wallet." : "Approve the STON.fi swap in your wallet.")
    setError("")
    try {
      const txResult = await tonConnectUI.sendTransaction({
        messages: [result.message],
        validUntil: Math.floor(Date.now() / 1000) + 300,
        from: tonAddress,
      })

      setSendStage("submitting")
      setSendDetail("Wallet signed. Recording the transaction in TipSwap.")
      const submitted = await api<ExternalSubmitResponse>(
        `/api/miniapp/tips/${result.tip.id}/external-submit`,
        initData,
        {
          method: "POST",
          body: JSON.stringify({ boc: txResult.boc }),
        },
      )

      if (result.provider === "tonpay" && submitted.payment.reference) {
        setSendStage("polling")
        setSendDetail("Payment submitted. Waiting for TON Pay to index the transfer.")
        const status = await pollTonPay(submitted.payment.reference)
        if (status.transfer.status === "success") {
          setMessage("Tip confirmed.")
          setSendStage("success")
          setSendDetail("The transfer is confirmed and history has been refreshed.")
        } else {
          const nextError = status.transfer.errorMessage ?? "Payment failed."
          setMessage(nextError)
          setSendStage("failed")
          setSendDetail(nextError)
        }
      } else {
        setMessage("Swap submitted. Tip is marked as sending while the transaction settles.")
        setSendStage("success")
        setSendDetail("The signed swap was submitted. History will show it as sending until reconciliation catches up.")
      }

      setQuote(null)
      await refresh()
    } catch (err) {
      const nextError = (err as Error).message
      setError(nextError)
      setSendStage("failed")
      setSendDetail(nextError)
    } finally {
      // Stage carries the result state.
    }
  }

  const connectedWalletDifferent = useMemo(() => {
    if (!tonAddress || !me?.wallet.address) return false
    return tonAddress !== me.wallet.address
  }, [tonAddress, me?.wallet.address])

  const sendSteps = useMemo<OperationStep[]>(() => {
    const external = quote?.type === "external"
    const labels = external
      ? [
          ["Quote", "Recipient, route, gas, and amount checked."],
          ["Wallet approval", "Approve the transaction in your connected wallet."],
          ["Submit", "Record the signed transaction with TipSwap."],
          [quote.provider === "tonpay" ? "Confirm" : "Track", quote.provider === "tonpay" ? "Wait for TON Pay confirmation." : "Watch history while the swap settles."],
        ]
      : [
          ["Quote", "Recipient, route, gas, and amount checked."],
          ["Submit", "Send from the managed wallet."],
          ["Confirm", "Wait for blockchain confirmation."],
        ]
    const activeIndex =
      sendStage === "quoting" ? 0 :
      sendStage === "wallet" ? 1 :
      sendStage === "submitting" ? (external ? 2 : 1) :
      sendStage === "polling" ? (external ? 3 : 2) :
      sendStage === "confirming" ? 1 :
      sendStage === "success" ? labels.length :
      sendStage === "failed" ? -1 :
      sendStage === "quote-ready" || sendStage === "claim-ready" ? 0 :
      -2

    return labels.map(([label, detail], index) => ({
      label,
      detail,
      state: sendStage === "failed" && index === Math.max(0, activeIndex)
        ? "error"
        : index < activeIndex || sendStage === "success"
          ? "done"
          : index === activeIndex
            ? "active"
            : "pending",
    }))
  }, [quote, sendStage])

  const showSendProgress = sendStage !== "idle" && sendStage !== "quote-ready" && sendStage !== "claim-ready"

  if (!authed) {
    return (
      <main className="min-h-screen bg-background px-5 py-8 text-foreground">
        <section className="mx-auto max-w-md rounded-lg border bg-card p-5">
          <h1 className="text-xl font-semibold">Open in Telegram</h1>
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

        {showSendProgress && (
          <OperationPanel
            title={
              sendStage === "success" ? "Send complete" :
              sendStage === "failed" ? "Action needs attention" :
              "Sending in progress"
            }
            detail={sendDetail || "TipSwap is processing this request."}
            steps={sendSteps}
            error={sendStage === "failed" ? sendDetail || error : undefined}
          />
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
                <Button onClick={() => connectAddress(tonAddress)} disabled={busy}>
                  {walletAction === "connect" && <Loader2 className="size-4 animate-spin" />}
                  Save connected wallet
                </Button>
              )}
              <div className="flex gap-2">
                <Input
                  value={manualAddress}
                  onChange={(event) => setManualAddress(event.target.value)}
                  placeholder="Paste UQ... address"
                />
                <Button size="icon" onClick={() => connectAddress(manualAddress)} disabled={busy}>
                  {walletAction === "connect" ? <Loader2 className="size-4 animate-spin" /> : <Clipboard className="size-4" />}
                </Button>
              </div>
              <Button variant="secondary" onClick={switchManaged} disabled={busy}>
                {walletAction === "managed" && <Loader2 className="size-4 animate-spin" />}
                Use managed wallet
              </Button>
            </div>
          </section>
        )}

        {tab === "send" && (
          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Send a tip</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {me?.wallet.mode === "external"
                    ? "Your connected wallet signs the transaction."
                    : "Your managed TipSwap wallet sends after confirmation."}
                </p>
              </div>
              <Badge variant="outline">{me?.wallet.mode ?? "..."}</Badge>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Input placeholder="@alice" value={sendForm.recipient} onChange={(e) => setSendForm({ ...sendForm, recipient: e.target.value })} />
              <Input placeholder="5" value={sendForm.amount} onChange={(e) => setSendForm({ ...sendForm, amount: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  Recipient gets
                  <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={sendForm.ask} onChange={(e) => setSendForm({ ...sendForm, ask: e.target.value })}>
                    {RECEIVE_OPTIONS.map((token) => (
                      <option key={token} value={token}>
                        {token === "AUTO" ? "Recipient preference" : token}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  You pay with
                  <select className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={sendForm.offer} onChange={(e) => setSendForm({ ...sendForm, offer: e.target.value })}>
                    {TOKENS.map((token) => <option key={token}>{token}</option>)}
                  </select>
                </label>
              </div>
              <Button onClick={createQuote} disabled={busy || !sendForm.recipient || !sendForm.amount}>
                {sendStage === "quoting" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {sendStage === "quoting" ? "Building quote" : me?.wallet.mode === "external" && !tonAddress ? "Connect wallet to review" : "Review quote"}
              </Button>
              <p className="text-xs text-muted-foreground">
                By default, the recipient&apos;s saved /receive token decides what they get.
              </p>
            </div>
            {["quoting", "failed"].includes(sendStage) && (
              <div
                className={cn(
                  "mt-4 rounded-md border p-3 text-sm",
                  sendStage === "failed"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                <div className="flex items-start gap-2">
                  {sendStage === "failed" ? (
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
                  )}
                  <div>
                    <p className="font-medium">{sendStage === "failed" ? "Could not build quote" : "Building quote"}</p>
                    <p className={cn("mt-1 text-xs", sendStage === "failed" ? "text-destructive" : "text-muted-foreground")}>
                      {sendStage === "failed" ? sendDetail || error : sendDetail || "Checking recipient, route, and balances."}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {quote?.type === "quote" && (
              <div className="mt-4 rounded-lg border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Quote ready</p>
                    <p className="text-muted-foreground">
                      @{quote.recipient.username} receives {quote.recipient.receiveToken}
                      {quote.recipient.usedPreference ? " by preference" : ""}
                    </p>
                  </div>
                  <StatusBadge status={quote.tip.status} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-secondary p-2">
                    <dt className="text-xs text-muted-foreground">They receive</dt>
                    <dd className="font-medium">{quote.tip.askAmount} {quote.tip.askToken}</dd>
                  </div>
                  <div className="rounded-md bg-secondary p-2">
                    <dt className="text-xs text-muted-foreground">You pay</dt>
                    <dd className="font-medium">{quote.quote.quotedOfferAmount} {quote.quote.offerSymbol}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">Expires {formatDateTime(quote.tip.expiresAt)}</p>
                <Button className="mt-3 w-full" onClick={() => confirmTip(quote.tip.id)} disabled={busy}>
                  {sendStage === "confirming" && <Loader2 className="size-4 animate-spin" />}
                  Confirm and send from managed wallet
                </Button>
              </div>
            )}
            {quote?.type === "external" && (
              <div className="mt-4 rounded-lg border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Wallet signature required</p>
                    <p className="text-muted-foreground">
                      @{quote.recipient.username} receives {quote.recipient.receiveToken}
                      {quote.recipient.usedPreference ? " by preference" : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="uppercase">{quote.provider}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-secondary p-2">
                    <dt className="text-xs text-muted-foreground">They receive</dt>
                    <dd className="font-medium">{quote.tip.askAmount} {quote.tip.askToken}</dd>
                  </div>
                  <div className="rounded-md bg-secondary p-2">
                    <dt className="text-xs text-muted-foreground">You pay</dt>
                    <dd className="font-medium">{quote.quote.quotedOfferAmount} {quote.quote.offerSymbol}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">
                  {quote.provider === "tonpay" ? "Direct payment via TON Pay" : `Swap route: STON.fi ${quote.quote.routerVersion}`}
                </p>
                <Button className="mt-3 w-full" onClick={() => confirmExternalTip(quote)} disabled={busy}>
                  {["wallet", "submitting", "polling"].includes(sendStage) && <Loader2 className="size-4 animate-spin" />}
                  {tonAddress ? "Open wallet and sign" : "Connect wallet to sign"}
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
            <Button className="mt-3 w-full" onClick={prepareClaim} disabled={busy || !claimCode}>
              {sendStage === "confirming" && <Loader2 className="size-4 animate-spin" />}
              Prepare claim for sender
            </Button>
          </section>
        )}

        {tab === "history" && (
          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Activity</h2>
                <p className="text-sm text-muted-foreground">Tips, swaps, claims, and wallet-signed payments.</p>
              </div>
              <Button variant="secondary" size="icon" onClick={refresh} disabled={refreshing}>
                <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
              </Button>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {history?.activity?.map((item) => <ActivityCard key={item.id} item={item} />)}
              {!history?.activity?.length && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-lg font-semibold">Settings</h2>
            <div className="mt-3 space-y-2 text-sm">
              <p>Receive token: <b>{me?.user.default_recv_token ?? "USDT"}</b></p>
              <p>Managed wallet sends bot-signed swaps and tips. External wallets can send from the Mini App with wallet signatures.</p>
              <Button variant="secondary" onClick={refresh} disabled={refreshing}>
                {refreshing && <Loader2 className="size-4 animate-spin" />}
                Refresh
              </Button>
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
