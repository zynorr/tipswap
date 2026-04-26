"use client"

import { motion } from "framer-motion"

const cases = [
  {
    title: "Community rewards",
    description:
      "Moderators and group admins tip contributors directly in chat. No payout spreadsheets, no manual transfers.",
    command: "/tip 10 USDT @contributor",
  },
  {
    title: "Creator micro-payments",
    description:
      "Readers tip writers, designers, and builders for the content they share. Small amounts, high frequency, zero friction.",
    command: "/tip 2 TON @creator",
  },
  {
    title: "Peer-to-peer payments",
    description:
      "Split a dinner bill, pay a friend back, or settle a bet. Works even if you hold different tokens.",
    command: "/tip 15 USDT @friend",
  },
  {
    title: "DAO contributor payouts",
    description:
      "Pay contributors from a DAO wallet in a single group message. Each person receives the token they prefer.",
    command: "/tip 50 USDT @dev1 @dev2 @dev3",
  },
]

export function UseCases() {
  return (
    <section id="use-cases" className="px-6 py-32">
      <div className="mx-auto w-full max-w-5xl">
        <motion.div
          className="flex flex-col gap-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[13px] font-medium tracking-wide text-primary">
            Use cases
          </p>
          <h2 className="max-w-lg text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            Built for real people sending real money.
          </h2>
        </motion.div>

        <div className="mt-16 grid gap-5 md:grid-cols-2">
          {cases.map((c, i) => (
            <motion.div
              key={c.title}
              className="flex flex-col justify-between gap-6 rounded-2xl border border-border bg-card p-7"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <div className="flex flex-col gap-3">
                <h3 className="text-[15px] font-semibold text-foreground">
                  {c.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {c.description}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3 font-mono text-xs text-primary">
                {c.command}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
