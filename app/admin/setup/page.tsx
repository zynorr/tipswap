"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, RefreshCw, Trash2 } from "lucide-react"

type WebhookInfo = {
  ok: boolean
  error?: string
  result?: {
    url: string
    pending_update_count: number
    last_error_date?: number
    last_error_message?: string
    has_custom_certificate?: boolean
  }
}

export default function AdminSetupPage() {
  const [info, setInfo] = useState<WebhookInfo | null>(null)
  const [url, setUrl] = useState("")
  const [adminToken, setAdminToken] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  function authHeaders(token = adminToken): HeadersInit {
    return token.trim()
      ? { authorization: `Bearer ${token.trim()}` }
      : {}
  }

  function updateAdminToken(value: string) {
    setAdminToken(value)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("tipswap-admin-token", value)
    }
  }

  async function refresh(tokenOverride = adminToken) {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch("/api/bot/setup", {
        headers: authHeaders(tokenOverride),
      })
      const data = (await r.json()) as WebhookInfo
      setInfo(data)
      if (!r.ok) {
        setMsg(data.error ?? "Could not load webhook info.")
      }
    } finally {
      setBusy(false)
    }
  }

  async function setWebhook() {
    if (!url.trim()) {
      setMsg("Enter a public URL first.")
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch("/api/bot/setup", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ action: "set", url }),
      })
      const data = await r.json()
      setMsg(JSON.stringify(data, null, 2))
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function deleteWebhook() {
    setBusy(true)
    setMsg(null)
    try {
      const r = await fetch("/api/bot/setup", {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ action: "delete" }),
      })
      const data = await r.json()
      setMsg(JSON.stringify(data, null, 2))
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const savedToken = window.localStorage.getItem("tipswap-admin-token") ?? ""
    setAdminToken(savedToken)
    refresh(savedToken)
    if (typeof window !== "undefined") {
      setUrl(window.location.origin)
    }
    // Run once on mount to hydrate the saved admin token and initial URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const result = info?.result

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="text-[12px] font-medium uppercase tracking-widest text-primary">
          TipSwap admin
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Bot webhook setup</h1>
        <p className="text-sm text-muted-foreground">
          Register your deployed app URL with Telegram so the bot starts receiving updates.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold">Admin access</h2>
        <Input
          type="password"
          value={adminToken}
          onChange={(e) => updateAdminToken(e.target.value)}
          placeholder="ADMIN_SETUP_TOKEN"
          className="h-11 font-mono text-xs"
        />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Current webhook</h2>
          <Button variant="ghost" size="sm" onClick={() => refresh()} disabled={busy}>
            <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {result ? (
          <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-xs">
            <dt className="text-muted-foreground">URL</dt>
            <dd className="col-span-2 break-all font-mono text-foreground">
              {result.url || <span className="text-muted-foreground">(none)</span>}
            </dd>
            <dt className="text-muted-foreground">Pending updates</dt>
            <dd className="col-span-2 text-foreground">{result.pending_update_count}</dd>
            {result.last_error_message && (
              <>
                <dt className="text-muted-foreground">Last error</dt>
                <dd className="col-span-2 text-red-400">{result.last_error_message}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">Loading...</p>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold">Register webhook</h2>
        <p className="text-xs text-muted-foreground">
          Paste your public URL (e.g. <code className="rounded bg-muted px-1">https://tipswap.vercel.app</code>).
          We&apos;ll append <code className="rounded bg-muted px-1">/api/bot</code> automatically.
        </p>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-deployment.vercel.app"
          className="h-11 font-mono text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={setWebhook} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Set webhook
          </Button>
          <Button variant="outline" onClick={deleteWebhook} disabled={busy}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete webhook
          </Button>
        </div>
        {msg && (
          <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-[11px]">
            {msg}
          </pre>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold">How to test</h2>
        <ol className="ml-4 list-decimal space-y-2 text-xs text-muted-foreground">
          <li>Set the webhook to your deployed URL (the input above is pre-filled).</li>
          <li>Open Telegram, search for your bot username, and send <code className="rounded bg-muted px-1">/start</code>.</li>
          <li>The bot replies with your generated TON wallet address.</li>
          <li>Send <code className="rounded bg-muted px-1">/wallet</code> to see balance, <code className="rounded bg-muted px-1">/swap 0.1 TON USDT</code> to test a swap.</li>
        </ol>
      </section>
    </main>
  )
}
