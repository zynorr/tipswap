"use client"

import { Button } from "@/components/ui/button"
import { ArrowRight, Gift } from "lucide-react"
import { motion } from "framer-motion"

export function Hero() {
  return (
    <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 pt-16">
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-16 md:flex-row md:items-center md:justify-between">
        {/* Left copy */}
        <motion.div
          className="flex max-w-lg flex-col gap-6 text-center md:text-left"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <p className="text-[13px] font-medium tracking-wide text-primary">
            Telegram-native payments on TON
          </p>

          <h1 className="text-balance font-sans text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-[56px]">
            Tip anyone in any token. Right inside Telegram.
          </h1>

          <p className="text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Reply with a command. Pick any token you hold. The recipient gets the token they want. The swap happens on-chain, in one transaction.
          </p>

          <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row md:items-start">
            <Button asChild size="lg" className="h-12 rounded-xl px-6 text-sm font-medium">
              <a href="#waitlist">
                Join the waitlist
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-12 rounded-xl px-6 text-sm font-medium text-muted-foreground">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>

          <div className="flex items-center justify-center gap-6 pt-2 md:justify-start">
            <Stat value="~5s" label="Settlement" />
            <div className="h-8 w-px bg-border" />
            <Stat value="<$0.01" label="Per tip" />
            <div className="h-8 w-px bg-border" />
            <Stat value="30K+" label="Tokens" />
          </div>
        </motion.div>

        {/* Right: chat mockup */}
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <HeroChat />
        </motion.div>
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 md:items-start">
      <span className="font-mono text-sm font-semibold text-foreground">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}

function HeroChat() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">TON Builders</p>
          <p className="text-[11px] text-muted-foreground">12 members</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-3 p-4">
        <Bubble side="left" name="alice">
          Great thread on liquidity routing
        </Bubble>

        <Bubble side="right" name="you" highlight>
          /tip 5 USDT @alice
        </Bubble>

        {/* Bot confirmation card */}
        <div className="mx-auto w-full rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Gift className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">TipSwap</span>
          </div>
          <div className="flex flex-col gap-2 text-[13px]">
            <Row label="You send" value="2.41 TON" />
            <Row label="alice gets" value="5.00 USDT" valueClass="text-primary font-medium" />
            <Row label="Via" value="STON.fi" />
            <Row label="Time" value="~5 seconds" />
          </div>
          <div className="mt-3 flex gap-2">
            <div className="flex-1 rounded-lg bg-primary py-2 text-center text-xs font-medium text-primary-foreground">
              Confirm
            </div>
            <div className="rounded-lg border border-border px-4 py-2 text-center text-xs text-muted-foreground">
              Cancel
            </div>
          </div>
        </div>

        <Bubble side="left" name="alice">
          5 USDT just hit my wallet. That was instant
        </Bubble>
      </div>
    </div>
  )
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={valueClass || "text-foreground"}>{value}</span>
    </div>
  )
}

function Bubble({
  side,
  name,
  highlight = false,
  children,
}: {
  side: "left" | "right"
  name: string
  highlight?: boolean
  children: React.ReactNode
}) {
  const isLeft = side === "left"
  return (
    <div className={`flex flex-col gap-1 ${isLeft ? "items-start" : "items-end"}`}>
      <span className="px-1 text-[10px] font-medium text-muted-foreground">
        {name}
      </span>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
          isLeft
            ? "rounded-bl-md bg-secondary text-foreground"
            : "rounded-br-md bg-primary/10 text-foreground"
        } ${highlight ? "font-mono text-primary" : ""}`}
      >
        {children}
      </div>
    </div>
  )
}
