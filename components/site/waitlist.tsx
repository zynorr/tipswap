"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, Loader2 } from "lucide-react"

export function Waitlist() {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle")
  const [email, setEmail] = useState("")
  const [tg, setTg] = useState("")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email) return
    setStatus("loading")
    // Placeholder — wire up to a real endpoint or Supabase later.
    await new Promise((r) => setTimeout(r, 700))
    setStatus("done")
  }

  return (
    <section
      id="waitlist"
      className="relative overflow-hidden border-b border-border"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, oklch(0.8 0.15 195 / 0.5), transparent)",
        }}
      />
      <div className="relative mx-auto w-full max-w-3xl px-6 py-24 text-center">
        <span className="font-mono text-xs uppercase tracking-widest text-primary">
          Get early access
        </span>
        <h2 className="mt-4 text-balance text-4xl font-medium leading-tight tracking-tight md:text-5xl">
          Be first when TipSwap goes live.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty leading-relaxed text-muted-foreground">
          We&apos;re opening private beta to the first 500 wallets. Drop your
          email and your Telegram handle and we&apos;ll send you the bot link
          before public launch.
        </p>

        {status === "done" ? (
          <div className="mx-auto mt-10 flex w-fit items-center gap-3 rounded-full border border-primary/30 bg-primary/10 px-5 py-3 text-sm text-foreground">
            <Check className="h-4 w-4 text-primary" />
            You&apos;re on the list. We&apos;ll be in touch.
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mx-auto mt-10 flex max-w-xl flex-col gap-3 text-left"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="bg-card"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="tg" className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Telegram handle
                </Label>
                <Input
                  id="tg"
                  name="tg"
                  value={tg}
                  onChange={(e) => setTg(e.target.value)}
                  placeholder="@yourhandle"
                  className="bg-card"
                />
              </div>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={status === "loading"}
              className="mt-2"
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining…
                </>
              ) : (
                "Join the waitlist"
              )}
            </Button>
            <p className="text-center font-mono text-[11px] text-muted-foreground">
              No spam. We&apos;ll only message you once when the beta opens.
            </p>
          </form>
        )}
      </div>
    </section>
  )
}
