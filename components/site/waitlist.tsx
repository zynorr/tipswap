"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, Check, Loader2 } from "lucide-react"
import { motion } from "framer-motion"

const CTAScene = dynamic(
  () => import("./cta-scene").then((m) => ({ default: m.CTAScene })),
  { ssr: false }
)

export function Waitlist() {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle")
  const [email, setEmail] = useState("")
  const [tg, setTg] = useState("")

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email) return
    setStatus("loading")
    await new Promise((r) => setTimeout(r, 700))
    setStatus("done")
  }

  return (
    <section id="waitlist" className="px-6 py-32">
      <motion.div
        className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 lg:flex-row lg:justify-between"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.5 }}
      >
        {/* 3D visual */}
        <div className="flex items-center justify-center lg:order-2">
          <CTAScene />
        </div>

        {/* Form side */}
        <div className="flex max-w-md flex-col gap-6 lg:order-1">
          <div className="flex flex-col gap-4 text-center lg:text-left">
            <p className="text-[13px] font-medium tracking-wide text-primary">
              Early access
            </p>
            <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
              Be first when TipSwap goes live.
            </h2>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              We are opening a private beta to the first 500 users. Leave your email and Telegram handle and we will send you the bot link before public launch.
            </p>
          </div>

          {status === "done" ? (
            <div className="flex w-fit items-center gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] px-6 py-4 text-sm text-foreground">
              <Check className="h-4 w-4 text-primary" />
              You are on the list. We will be in touch.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="h-12 rounded-xl border-border bg-card px-4 text-sm placeholder:text-muted-foreground"
              />
              <Input
                value={tg}
                onChange={(e) => setTg(e.target.value)}
                placeholder="Telegram handle (optional)"
                className="h-12 rounded-xl border-border bg-card px-4 text-sm placeholder:text-muted-foreground"
              />
              <Button
                type="submit"
                disabled={status === "loading"}
                className="h-12 rounded-xl text-sm font-medium"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    Join the waitlist
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              <p className="pt-1 text-center text-[11px] text-muted-foreground lg:text-left">
                No spam. One email when the beta opens.
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </section>
  )
}
