/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["calculators-tips-cooked-countries.trycloudflare.com"],
  serverExternalPackages: ["@ton-pay/api"],
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: import.meta.dirname,
  },
}

export default nextConfig
