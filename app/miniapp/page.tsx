import { MiniAppClient } from "./ui"
import Script from "next/script"

export const dynamic = "force-dynamic"

export default function MiniAppPage() {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <MiniAppClient />
    </>
  )
}
