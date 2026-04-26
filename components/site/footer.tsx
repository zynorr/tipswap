export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12 md:flex-row md:justify-between">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              TipSwap
            </span>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Telegram-native tipping on TON. Powered by STON.fi.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Product
            </p>
            <a href="#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#use-cases" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Use cases
            </a>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Ecosystem
            </p>
            <a href="https://ston.fi" target="_blank" rel="noreferrer" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              STON.fi
            </a>
            <a href="https://ton.org" target="_blank" rel="noreferrer" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              TON
            </a>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Connect
            </p>
            <a href="#waitlist" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Waitlist
            </a>
            <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Telegram
            </a>
            <a href="#" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              GitHub
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5 text-[11px] text-muted-foreground">
          <p>2026 TipSwap</p>
          <p>Built on TON</p>
        </div>
      </div>
    </footer>
  )
}
