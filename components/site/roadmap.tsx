const milestones = [
  {
    n: "M1",
    weeks: "Weeks 1–2",
    title: "Foundation",
    deliverable:
      "grammY bot, Next.js backend, Supabase schema, STON.fi SDK integrated. /swap works end-to-end from a test wallet.",
    items: [
      "Bot scaffold + Telegram login auth",
      "STON.fi SDK first swap",
      "TON Connect for Pro Mode",
    ],
  },
  {
    n: "M2",
    weeks: "Weeks 3–4",
    title: "Wallet & Custody",
    deliverable:
      "MPC-lite key generation with one share in the backend, one in Telegram Cloud Storage. New users onboard in under 30 seconds.",
    items: [
      "Auto wallet creation on /start",
      "Balance + deposit QR",
      "Recovery and self-custody export",
    ],
  },
  {
    n: "M3",
    weeks: "Weeks 4–5",
    title: "Tipping Core",
    deliverable:
      "/tip command, Omniston quotes with confirmation UI, atomic swap-and-send, tip history and receipt cards.",
    items: [
      "Command parser + recipient resolver",
      "Quote → confirm → broadcast flow",
      "Receipt cards in chat",
    ],
  },
  {
    n: "M4",
    weeks: "Week 6",
    title: "Escrow Contract",
    deliverable:
      "FunC escrow contract on mainnet. Tip recipients who haven't joined the bot yet, with auto-refund after 30 days.",
    items: [
      "Smart contract development + tests",
      "Tip-by-tg_id with claim links",
      "Auto-refund worker",
    ],
  },
  {
    n: "M5",
    weeks: "Week 7",
    title: "Mini App & Polish",
    deliverable:
      "Full Telegram Mini App with reaction-based tipping, group split tips, leaderboards, and slippage controls.",
    items: [
      "Mini App balance + history",
      "Reaction tipping (the viral lever)",
      "Group split + leaderboards",
    ],
  },
  {
    n: "M6",
    weeks: "Week 8",
    title: "Beta & Grant Report",
    deliverable:
      "Closed beta in 3–5 Telegram communities (~500 users), public launch, and a metrics dashboard handed back to STON.fi.",
    items: [
      "Sentry + PostHog dashboards",
      "Public launch + landing",
      "Volume, wallets, retention report",
    ],
  },
]

const budget = [
  { label: "Engineering — bot, backend, mini app", amount: "$6,500" },
  { label: "Smart contract development & testing", amount: "$2,000" },
  { label: "Infra (RPC, Vercel, Supabase) for build + beta", amount: "$800" },
  { label: "Contingency / debugging buffer", amount: "$700" },
]

export function Roadmap() {
  return (
    <section id="roadmap" className="relative border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="flex flex-col items-start gap-4">
          <span className="font-mono text-xs uppercase tracking-widest text-primary">
            Roadmap
          </span>
          <h2 className="max-w-3xl text-balance text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            Six milestones. Eight weeks. One shippable bot.
          </h2>
          <p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Scoped tightly to the $10K STON.fi grant. Every milestone has a
            concrete deliverable that can be demoed live.
          </p>
        </div>

        <ol className="mt-16 grid gap-4 md:grid-cols-2">
          {milestones.map((m) => (
            <li
              key={m.n}
              className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                    {m.n}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {m.weeks}
                  </span>
                </div>
              </div>

              <h3 className="text-xl font-medium">{m.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {m.deliverable}
              </p>

              <ul className="mt-auto flex flex-col gap-1.5 border-t border-border pt-4">
                {m.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 font-mono text-xs text-muted-foreground"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <div className="mt-16 grid gap-8 rounded-xl border border-border bg-card p-8 md:grid-cols-[1fr_1.4fr] md:gap-16">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-primary">
              Budget allocation
            </span>
            <p className="mt-3 text-2xl font-medium">$10,000 USDT</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Per grant rules, all funds go to development — coding, debugging,
              and security testing. Marketing is self-funded post-launch.
            </p>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {budget.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between gap-6 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-sm text-muted-foreground">
                  {row.label}
                </span>
                <span className="font-mono text-sm">{row.amount}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
