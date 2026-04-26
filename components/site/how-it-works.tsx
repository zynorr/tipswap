"use client"

import { motion } from "framer-motion"

const steps = [
  {
    step: "01",
    title: "Reply with a tip",
    description: "Type /tip 5 USDT @alice in any Telegram chat. TipSwap resolves the recipient and fetches a live swap quote.",
    detail: "/tip 5 USDT @alice",
  },
  {
    step: "02",
    title: "Review and confirm",
    description: "The bot shows you exactly what you pay, what they receive, and the exchange rate. One tap to confirm.",
    detail: "2.41 TON -> 5.00 USDT",
  },
  {
    step: "03",
    title: "Recipient gets paid",
    description: "The swap and transfer happen atomically on TON. Either both succeed or nothing moves. The recipient is notified instantly.",
    detail: "Settled in ~5 seconds",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-32">
      <div className="mx-auto w-full max-w-5xl">
        <motion.div
          className="flex flex-col gap-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[13px] font-medium tracking-wide text-primary">
            How it works
          </p>
          <h2 className="max-w-lg text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
            Three steps. One transaction. Done.
          </h2>
        </motion.div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              className="group flex flex-col gap-5 rounded-2xl border border-border bg-card p-7"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
            >
              <span className="font-mono text-xs text-muted-foreground">
                {s.step}
              </span>
              <div className="flex flex-col gap-3">
                <h3 className="text-lg font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {s.description}
                </p>
              </div>
              <div className="mt-auto rounded-lg border border-border bg-background px-4 py-3 font-mono text-xs text-primary">
                {s.detail}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
