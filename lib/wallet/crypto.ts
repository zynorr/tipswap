import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto"

/**
 * AES-256-GCM encryption for sensitive data (wallet mnemonics).
 * Format on disk: scryptSalt(16):iv(12):authTag(16):ciphertext  — all hex, ":"-joined.
 */
const KEY_LEN = 32
const IV_LEN = 12
const SALT_LEN = 16
const TAG_LEN = 16

function getMasterKey() {
  const key = process.env.WALLET_ENCRYPTION_KEY
  if (!key || key.length < 32) {
    throw new Error("WALLET_ENCRYPTION_KEY must be set and at least 32 chars")
  }
  return key
}

function deriveKey(salt: Buffer): Buffer {
  return scryptSync(getMasterKey(), salt, KEY_LEN)
}

export function encryptString(plaintext: string): string {
  const salt = randomBytes(SALT_LEN)
  const iv = randomBytes(IV_LEN)
  const key = deriveKey(salt)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    salt.toString("hex"),
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":")
}

export function decryptString(payload: string): string {
  const parts = payload.split(":")
  if (parts.length !== 4) throw new Error("Malformed encrypted payload")
  const [saltHex, ivHex, tagHex, ctHex] = parts
  const salt = Buffer.from(saltHex, "hex")
  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  const ct = Buffer.from(ctHex, "hex")

  if (salt.length !== SALT_LEN || iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error("Invalid encrypted payload sizes")
  }

  const key = deriveKey(salt)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(ct), decipher.final()])
  return decrypted.toString("utf8")
}
