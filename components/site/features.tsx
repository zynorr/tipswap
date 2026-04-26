"use client"

import { motion } from "framer-motion"
import {
  ArrowLeftRight,
  Lock,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react"

const features = [
  {
    icon: ArrowLeftRight,
    title: "Any token to any token",
    description:
      "You hold TON, they want USDT. TipSwap routes through STON.fi so both sides use the token they prefer.",
  },
  {
    icon: Sparkles,
    title: "Reaction tipping",
    description:
      "React to a message with a single tap to tip a default amount. No commands, no friction.",
  },
  {
    icon: Users,
    title: "Split across a group",
    description:
      "Tip multiple people at once. One command, one transaction, split evenly across recipients.",
  },
  {
    icon: Lock,
    title: "Tip anyone, even non-users",
    description:
      "Funds are held in a smart contract until the recipient opens TipSwap. Unclaimed tips auto-refund after 30 days.",
  },
  {
    icon: Wallet,
    title: "Self-custody or instant wallet",
    description:
      "Connect your own wallet via TON Connect, or get started in seconds with a managed wallet. Your choice.",
  },
  {
    icon: Smartphone,
    title: "Full control in a Mini App",
    description:
      "Check balances, view tip history, adjust slippage, and manage your wallet without leaving Telegram.",
  },
]

export function Features() {
  return (
    <section id="features" className="px-6 py-32">
      <div className="mx-auto w-full max-w-5xl">
        <motion.div
          className="flex flex-col gap-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[13px] font-medium tracking-wide text-primary">
            Features
          </p>
          <h2 className="max-w-lg text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            Designed for how people already use Telegram.
          </h2>
        </motion.div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const Icon = f.icon
            return (
              <motion.div
                key={f.title}
                className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-7 transition-colors hover:border-primary/30"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </div>
                <h3 className="text-[15px] font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
