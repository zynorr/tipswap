import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { validateTelegramInitData } from "../init-data"

function signedInitData(params: Record<string, string>, token = "123:abc") {
  const dataCheckString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
  const secret = createHmac("sha256", "WebAppData").update(token).digest()
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex")
  const search = new URLSearchParams(params)
  search.set("hash", hash)
  return search.toString()
}

describe("validateTelegramInitData", () => {
  it("validates signed Telegram Mini App init data", () => {
    const initData = signedInitData({
      auth_date: String(Math.floor(Date.now() / 1000)),
      query_id: "query-1",
      start_param: "claim_abc",
      user: JSON.stringify({ id: 123, username: "alice", first_name: "Alice" }),
    })

    const result = validateTelegramInitData(initData, "123:abc")

    expect(result.user).toMatchObject({ id: 123, username: "alice" })
    expect(result.queryId).toBe("query-1")
    expect(result.startParam).toBe("claim_abc")
  })

  it("rejects tampered init data", () => {
    const initData = signedInitData({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 123, username: "alice" }),
    }).replace("alice", "mallory")

    expect(() => validateTelegramInitData(initData, "123:abc")).toThrow("hash is invalid")
  })

  it("rejects expired init data", () => {
    const initData = signedInitData({
      auth_date: String(Math.floor(Date.now() / 1000) - 10_000),
      user: JSON.stringify({ id: 123, username: "alice" }),
    })

    expect(() => validateTelegramInitData(initData, "123:abc", 60)).toThrow("expired")
  })
})

