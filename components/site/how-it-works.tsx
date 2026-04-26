import { ArrowRight } from "lucide-react"

const steps = [
  {
    n: "01",
    title: "Send a command",
    body: "Reply to any message with /tip 5 USDT. The bot resolves the recipient's wallet from their Telegram ID.",
    code: "/tip 5 USDT @alice",
  },
  {
    n: "02",
    title: "Omniston routes the swap",
    body: "TipSwap fetches a real-time quote via the STON.fi SDK and Omniston RFQ, then builds an atomic swap-and-send transaction.",
    code: "router.getSwapTxParams({ ... })",
  },
  {
    n: "03",
    title: "Recipient gets their token",
    body: "The transaction settles in one TON message tree. Either both legs succeed or both revert — no half-swaps, ever.",
    code: "→ 5.00 USDT credited",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="flex flex-col items-start gap-4">
          <span className="font-mono text-xs uppercase tracking-widest text-primary">
            How it works
          </span>
          <h2 className="max-w-3xl text-balance text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            One command. One transaction.{" "}
            <span className="text-muted-foreground">Any token to any token.</span>
          </h2>
        </div>

        <div className="mt-16 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.n}
              className="relative flex flex-col gap-6 bg-card p-8"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">
                  {step.n}
                </span>
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden h-4 w-4 text-muted-foreground md:block" />
                )}
              </div>
              <h3 className="text-xl font-medium">{step.title}</h3>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
              <pre className="overflow-x-auto rounded-lg border border-border bg-background/60 p-3 font-mono text-xs text-primary">
                {step.code}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
