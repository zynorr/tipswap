export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const fallbackOrigin = new URL(req.url).origin
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? fallbackOrigin).replace(/\/$/, "")

  return Response.json({
    url: appUrl,
    name: "TipSwap",
    iconUrl: `${appUrl}/icon.svg`,
    termsOfUseUrl: appUrl,
    privacyPolicyUrl: appUrl,
  })
}

