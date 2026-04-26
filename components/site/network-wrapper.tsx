"use client"

import dynamic from "next/dynamic"

const NetworkBackground = dynamic(
  () =>
    import("@/components/site/network-bg").then((m) => ({
      default: m.NetworkBackground,
    })),
  { ssr: false }
)

export function NetworkWrapper() {
  return <NetworkBackground />
}
