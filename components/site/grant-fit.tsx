import { Check } from "lucide-react"

const criteria = [
  {
    title: "Innovation",
    body: "Cross-token tipping inside Telegram is a primitive that doesn't exist on TON yet. Reaction-based tipping is a net-new social mechanic.",
  },
  {
    title: "DeFi impact",
    body: "Onboards Telegram users who have never used a wallet. Every tip is a measurable STON.fi swap. Net-new TVL and volume for the protocol.",
  },
  {
    title: "Technical feasibility",
    body: "Direct integration with @ston-fi/sdk and Omniston RFQ. Eight-week scope is concrete and demoable end-to-end.",
  },
  {
    title: "Sustainability",
    body: "Revenue model: 0.3% protocol fee on tips after launch covers infra and continued development. Open-source escrow + custody helpers benefit the wider TON ecosystem.",
  },
  {
    title: "Compliance",
    body: "Self-custody-by-default architecture. Managed-wallet mode is capped at small balances pre-audit. No gambling, no anonymous bulk transfers.",
  },
]

export function GrantFit() {
  return (
    <section id="grant" className="relative border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="grid gap-12 md:grid-cols-[1fr_1.3fr] md:gap-16">
          <div className="flex flex-col gap-4">
            <span className="font-mono text-xs uppercase tracking-widest text-primary">
              Grant fit
            </span>
            <h2 className="text-balance text-4xl font-medium leading-tight tracking-tight md:text-5xl">
              Mapped directly to STON.fi&apos;s selection criteria.
            </h2>
            <p className="text-pretty leading-relaxed text-muted-foreground">
              The STON.fi grant program looks for projects that integrate the
              SDK or widget, push DeFi adoption forward, and ship something
              real. TipSwap was scoped to hit every criterion.
            </p>
            <a
              href="https://ston.fi/grant-program"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 font-mono text-sm text-primary hover:underline"
            >
              Read the grant program
              <span aria-hidden>→</span>
            </a>
          </div>

          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
            {criteria.map((c) => (
              <li key={c.title} className="flex gap-4 p-5">
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-medium">{c.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {c.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
