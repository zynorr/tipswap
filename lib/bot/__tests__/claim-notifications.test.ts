import { describe, expect, it } from "vitest"
import { claimConfirmationReplyMarkup } from "@/lib/bot/claim-notifications"
import type { TgWallet } from "@/lib/bot/users"

const managedWallet = {
  id: "wallet-managed",
  user_id: "user-1",
  address: "UQmanaged",
  public_key: "public-key",
  encrypted_mnemonic: "encrypted",
  mode: "managed",
  is_active: true,
} satisfies TgWallet

const externalWallet = {
  id: "wallet-external",
  user_id: "user-1",
  address: "UQexternal",
  public_key: null,
  encrypted_mnemonic: null,
  mode: "external",
  is_active: true,
} satisfies TgWallet

describe("claimConfirmationReplyMarkup", () => {
  it("uses callback confirmation for managed sender wallets", () => {
    expect(claimConfirmationReplyMarkup("tip-1", managedWallet)).toEqual({
      inline_keyboard: [[
        { text: "Confirm", callback_data: "tip:confirm:tip-1" },
        { text: "Cancel", callback_data: "tip:cancel:tip-1" },
      ]],
    })
  })

  it("uses a Telegram Web App button for external sender wallet signing", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com"

    expect(claimConfirmationReplyMarkup("tip-1", externalWallet)).toEqual({
      inline_keyboard: [
        [{ text: "Open Mini App to sign", web_app: { url: "https://app.example.com/miniapp?signTip=tip-1" } }],
        [{ text: "Cancel", callback_data: "tip:cancel:tip-1" }],
      ],
    })
  })
})
