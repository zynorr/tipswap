import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
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
  title: "TipSwap — Tip anyone on Telegram in any token",
  description:
    "Send tips in any TON token right inside Telegram. The recipient gets the token they want. Powered by STON.fi.",
  openGraph: {
    title: "TipSwap — Tip anyone on Telegram in any token",
    description:
      "Send tips in any TON token right inside Telegram. The recipient gets the token they want.",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#0f1119",
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
      </body>
    </html>
  )
}
