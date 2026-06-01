/** @type {import('next').NextConfig} */
function devOrigins() {
  const values = [
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",") ?? []),
  ].filter(Boolean)

  return Array.from(new Set(values.map((value) => {
    const trimmed = value.trim().replace(/\/$/, "")
    try {
      return new URL(trimmed).host
    } catch {
      return trimmed.replace(/^https?:\/\//, "")
    }
  }).filter(Boolean)))
}

const allowedDevOrigins = devOrigins()

const nextConfig = {
  ...(allowedDevOrigins.length ? { allowedDevOrigins } : {}),
  serverExternalPackages: ["@ton-pay/api"],
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: import.meta.dirname,
  },
}

export default nextConfig
