import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "TipSwap — Tip anyone on Telegram, in any token",
  description:
    "TipSwap turns every Telegram message into a programmable payment. Built on TON, powered by STON.fi. Senders pay in any token, recipients receive theirs.",
  generator: "v0.app",
  openGraph: {
    title: "TipSwap — Tip anyone on Telegram, in any token",
    description:
      "Built on TON, powered by STON.fi. Senders pay in any token, recipients receive theirs.",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#0a1018",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
