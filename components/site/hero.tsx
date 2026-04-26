import { Button } from "@/components/ui/button"
import { ArrowRight, Check, Gift } from "lucide-react"

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, oklch(0.8 0.15 195 / 0.4), transparent)",
        }}
      />

      <div className="relative mx-auto grid w-full max-w-6xl gap-16 px-6 py-24 md:grid-cols-[1.1fr_1fr] md:items-center md:py-32">
        <div className="flex flex-col gap-6">
          <a
            href="https://ston.fi/grant-program"
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            STON.fi Grant Application
            <ArrowRight className="h-3 w-3" />
          </a>

          <h1 className="text-balance font-sans text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            <span className="text-gradient-primary">Tip anyone on Telegram,</span>
            <br />
            <span className="text-foreground">in any token.</span>
          </h1>

          <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            TipSwap turns every Telegram message into a programmable payment.
            Senders pay in TON, recipients receive USDT — STON.fi handles the
            swap atomically in between.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button asChild size="lg">
              <a href="#waitlist">
                Join the waitlist
                <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#architecture">View architecture</a>
            </Button>
          </div>

          <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-4 text-sm text-muted-foreground">
            {[
              "Built on TON",
              "Powered by STON.fi SDK",
              "Self-custody by default",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <HeroChat />
      </div>
    </section>
  )
}

function HeroChat() {
  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute -inset-4 rounded-2xl opacity-50 blur-2xl"
        style={{
          background:
            "radial-gradient(closest-side, oklch(0.8 0.15 195 / 0.25), transparent)",
        }}
      />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/15" />
            <div>
              <p className="font-mono text-xs font-medium">@TipSwapBot</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                online · 4 members
              </p>
            </div>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Telegram
          </span>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <ChatBubble side="left" name="alice">
            gm — loved your thread on TON liquidity
          </ChatBubble>

          <ChatBubble side="right" name="bob" command>
            /tip 5 USDT @alice
          </ChatBubble>

          <div className="self-end rounded-2xl rounded-br-sm border border-primary/30 bg-primary/10 p-4 text-sm">
            <div className="mb-3 flex items-center gap-2 font-mono text-xs text-primary">
              <Gift className="h-3.5 w-3.5" />
              Confirm tip
            </div>
            <dl className="grid gap-1.5 font-mono text-xs">
              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">You pay</dt>
                <dd>2.41 TON</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">@alice receives</dt>
                <dd className="text-primary">5.00 USDT</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">Route</dt>
                <dd>STON.fi · Omniston</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-muted-foreground">Slippage</dt>
                <dd>1.0%</dd>
              </div>
            </dl>
          </div>

          <ChatBubble side="left" name="alice">
            wait — 5 USDT just dropped in my wallet?
          </ChatBubble>

          <ChatBubble side="left" name="alice">
            i don&apos;t even hold TON. how??
          </ChatBubble>
        </div>

        <div className="flex items-center gap-2 border-t border-border bg-muted/20 px-4 py-3">
          <div className="flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 font-mono text-xs text-muted-foreground">
            type a message…
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatBubble({
  side,
  name,
  command = false,
  children,
}: {
  side: "left" | "right"
  name: string
  command?: boolean
  children: React.ReactNode
}) {
  const isLeft = side === "left"
  return (
    <div className={`flex flex-col gap-1 ${isLeft ? "items-start" : "items-end"}`}>
      <span className="px-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        @{name}
      </span>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
          isLeft
            ? "rounded-bl-sm bg-muted/60 text-foreground"
            : "rounded-br-sm border border-border bg-background"
        } ${command ? "font-mono text-primary" : ""}`}
      >
        {children}
      </div>
    </div>
  )
}
