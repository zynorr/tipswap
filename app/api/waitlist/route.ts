import { NextResponse } from "next/server"
import { adminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

export async function POST(req: Request) {
  let body: { email?: string; telegram_handle?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const telegram = body.telegram_handle?.trim().replace(/^@/, "") || null

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
  }

  try {
    const supabase = adminClient()
    const { error } = await supabase
      .from("waitlist")
      .insert({ email, telegram_handle: telegram })

    if (error) {
      // Duplicate email — treat as success, the user is already in.
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, alreadySubscribed: true })
      }
      console.error("[tipswap] waitlist insert error:", error)
      return NextResponse.json({ error: "Could not save signup" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[tipswap] waitlist exception:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
