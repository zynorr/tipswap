import { Coins, UserX, Zap } from "lucide-react"

const problems = [
  {
    icon: Coins,
    title: "Wrong-token friction",
    body: "You hold TON, your friend wants USDT. Today, that's a manual swap, a wallet switch, and three apps later, the moment is gone.",
  },
  {
    icon: UserX,
    title: "No-wallet dead-ends",
    body: "Telegram has a billion users. Most don't have a TON wallet. There's no way to tip them — the gift just bounces.",
  },
  {
    icon: Zap,
    title: "Zero virality",
    body: "Tipping should be one tap, inside the chat. Instead, current tools push users out to dApps and break the social loop.",
  },
]

export function Problem() {
  return (
    <section className="relative border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <span className="font-mono text-xs uppercase tracking-widest text-primary">
            The problem
          </span>
          <h2 className="text-balance text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            Tipping in crypto is broken on Telegram.
          </h2>
          <p className="text-pretty text-lg leading-relaxed text-muted-foreground">
            The world&apos;s biggest messaging app sits on top of the world&apos;s
            fastest L1, and somehow you still can&apos;t hand someone five
            dollars without breaking flow.
          </p>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {problems.map((problem) => {
            const Icon = problem.icon
            return (
              <div
                key={problem.title}
                className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-medium">{problem.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {problem.body}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
