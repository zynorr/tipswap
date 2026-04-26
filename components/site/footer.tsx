import { Sparkles } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="font-mono text-sm font-medium tracking-tight">
              TipSwap
            </span>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            A Telegram-native tipping bot built on TON. Powered by the STON.fi
            SDK and Omniston RFQ.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-12 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Product
            </p>
            <a href="#how-it-works" className="text-sm hover:text-primary">
              How it works
            </a>
            <a href="#architecture" className="text-sm hover:text-primary">
              Architecture
            </a>
            <a href="#roadmap" className="text-sm hover:text-primary">
              Roadmap
            </a>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Ecosystem
            </p>
            <a
              href="https://ston.fi"
              target="_blank"
              rel="noreferrer"
              className="text-sm hover:text-primary"
            >
              STON.fi
            </a>
            <a
              href="https://ston.fi/grant-program"
              target="_blank"
              rel="noreferrer"
              className="text-sm hover:text-primary"
            >
              Grant program
            </a>
            <a
              href="https://ton.org"
              target="_blank"
              rel="noreferrer"
              className="text-sm hover:text-primary"
            >
              TON
            </a>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Connect
            </p>
            <a href="#waitlist" className="text-sm hover:text-primary">
              Waitlist
            </a>
            <a href="#" className="text-sm hover:text-primary">
              Telegram
            </a>
            <a href="#" className="text-sm hover:text-primary">
              GitHub
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-2 px-6 py-6 font-mono text-[11px] text-muted-foreground md:flex-row md:items-center">
          <p>© 2026 TipSwap. Independent project.</p>
          <p>Not affiliated with STON.fi or Telegram. Built for the grant program.</p>
        </div>
      </div>
    </footer>
  )
}
