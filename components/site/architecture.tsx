import {
  ArrowDown,
  Bot,
  Database,
  Layers,
  MessageSquare,
  Server,
  Wallet,
} from "lucide-react"

const layers = [
  {
    icon: MessageSquare,
    label: "Telegram Client",
    sub: "User · Bot · Mini App",
    tag: "UI",
  },
  {
    icon: Bot,
    label: "Bot Interface",
    sub: "grammY · webhook · command parser",
    tag: "Edge",
  },
  {
    icon: Server,
    label: "TipSwap Backend",
    sub: "Next.js · tRPC · Inngest jobs",
    tag: "API",
  },
  {
    icon: Database,
    label: "State & Custody",
    sub: "Postgres · MPC-lite key shares · TON Connect",
    tag: "Data",
  },
  {
    icon: Layers,
    label: "STON.fi SDK + Omniston",
    sub: "Quote · Route · Build swap message",
    tag: "Swap",
  },
  {
    icon: Wallet,
    label: "TON Blockchain",
    sub: "Atomic swap-and-send · Escrow contract (FunC)",
    tag: "L1",
  },
]

const integrationPoints = [
  {
    title: "@ston-fi/sdk",
    body: "Router.getSwapTxParams builds every swap-and-send message.",
  },
  {
    title: "Omniston RFQ",
    body: "Best-route quotes for cross-token tips, cached server-side.",
  },
  {
    title: "Pool discovery",
    body: "Token whitelist validation against live STON.fi pools.",
  },
  {
    title: "Slippage controls",
    body: "Per-tip user preference, default 1%, configurable in the Mini App.",
  },
]

export function Architecture() {
  return (
    <section
      id="architecture"
      className="relative overflow-hidden border-b border-border"
    >
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-24">
        <div className="flex flex-col items-start gap-4">
          <span className="font-mono text-xs uppercase tracking-widest text-primary">
            Architecture
          </span>
          <h2 className="max-w-3xl text-balance text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            A clean stack with one job:{" "}
            <span className="text-muted-foreground">
              get the right token to the right person.
            </span>
          </h2>
        </div>

        <div className="mt-16 grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div className="flex flex-col gap-2">
            {layers.map((layer, i) => {
              const Icon = layer.icon
              return (
                <div key={layer.label} className="flex flex-col items-stretch gap-2">
                  <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{layer.label}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {layer.sub}
                      </p>
                    </div>
                    <span className="hidden rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
                      {layer.tag}
                    </span>
                  </div>
                  {i < layers.length - 1 && (
                    <div className="flex justify-center text-border">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-8">
            <div>
              <h3 className="font-mono text-xs uppercase tracking-widest text-primary">
                STON.fi integration points
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Every tip is a swap. Four explicit integration surfaces with the
                STON.fi SDK and Omniston, all called from the TipSwap backend.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {integrationPoints.map((point) => (
                <div
                  key={point.title}
                  className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-5"
                >
                  <code className="font-mono text-sm text-primary">
                    {point.title}
                  </code>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {point.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
              <p className="font-mono text-xs uppercase tracking-widest text-primary">
                Open-source contribution
              </p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">
                The MPC-lite custody helpers and the TipSwap escrow contract
                will be released MIT-licensed for any TON project to reuse.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
