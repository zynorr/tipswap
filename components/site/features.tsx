import {
  Heart,
  Lock,
  PartyPopper,
  Shield,
  Smartphone,
  Users,
} from "lucide-react"

const features = [
  {
    icon: Heart,
    title: "Cross-token tips",
    body: "Pay in TON, recipient gets USDT. Or any pair Omniston can route.",
  },
  {
    icon: PartyPopper,
    title: "Reaction tipping",
    body: "React with the gift emoji to send a default tip. One tap, zero friction.",
  },
  {
    icon: Users,
    title: "Group split tips",
    body: "/tip 1 TON @a @b @c splits across recipients in a single transaction.",
  },
  {
    icon: Lock,
    title: "Escrow for non-users",
    body: "Tip anyone by Telegram ID. Funds wait in a smart contract until they claim.",
  },
  {
    icon: Shield,
    title: "Self-custody mode",
    body: "Connect Tonkeeper or MyTonWallet via TON Connect. Your keys, your coins.",
  },
  {
    icon: Smartphone,
    title: "Telegram Mini App",
    body: "Manage balances, slippage, history, and leaderboards without leaving Telegram.",
  },
]

export function Features() {
  return (
    <section className="relative border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-24">
        <div className="flex flex-col items-start gap-4">
          <span className="font-mono text-xs uppercase tracking-widest text-primary">
            Features
          </span>
          <h2 className="max-w-3xl text-balance text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            Built for the way people already chat.
          </h2>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-base font-medium">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.body}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
