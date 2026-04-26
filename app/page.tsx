import { SiteNav } from "@/components/site/nav"
import { Hero } from "@/components/site/hero"
import { HowItWorks } from "@/components/site/how-it-works"
import { Features } from "@/components/site/features"
import { UseCases } from "@/components/site/use-cases"
import { Waitlist } from "@/components/site/waitlist"
import { SiteFooter } from "@/components/site/footer"

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteNav />
      <Hero />
      <HowItWorks />
      <Features />
      <UseCases />
      <Waitlist />
      <SiteFooter />
    </main>
  )
}
