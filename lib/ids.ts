import { randomBytes, randomInt } from "node:crypto";

// Event code: short, typeable, no confusable chars. 5 chars ≈ 22M space.
const EVENT_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateEventCode(length = 5): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += EVENT_CODE_ALPHABET[randomInt(EVENT_CODE_ALPHABET.length)];
  }
  return out;
}

// 96-bit url-safe random — used for player access_code and qr_nonce.
export function generate96BitToken(): string {
  return randomBytes(12).toString("base64url");
}
