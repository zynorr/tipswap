import { SiteNav } from "@/components/site/nav"
import { Hero } from "@/components/site/hero"
import { Problem } from "@/components/site/problem"
import { HowItWorks } from "@/components/site/how-it-works"
import { Features } from "@/components/site/features"
import { Architecture } from "@/components/site/architecture"
import { Roadmap } from "@/components/site/roadmap"
import { GrantFit } from "@/components/site/grant-fit"
import { Waitlist } from "@/components/site/waitlist"
import { SiteFooter } from "@/components/site/footer"

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteNav />
      <Hero />
      <Problem />
      <HowItWorks />
      <Features />
      <Architecture />
      <Roadmap />
      <GrantFit />
      <Waitlist />
      <SiteFooter />
    </main>
  )
}
