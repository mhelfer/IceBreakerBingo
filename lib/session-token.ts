import { createHmac, timingSafeEqual } from "node:crypto";

// Split facilitator and player sessions into distinct cookies so that a
// facilitator testing a player link in another tab doesn't blow away their
// admin session (both kinds can coexist in the same browser profile).
export const FACILITATOR_COOKIE_NAME = "ibb_session_fac";
export const PLAYER_COOKIE_NAME = "ibb_session_p";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days

export type SessionPayload =
  | { kind: "facilitator"; facilitator_id: string; iat: number }
  | { kind: "player"; player_id: string; event_id: string; iat: number };

function secret(): Buffer {
  const s = process.env.SESSION_COOKIE_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "SESSION_COOKIE_SECRET must be set and at least 32 chars long",
    );
  }
  return Buffer.from(s);
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string): SessionPayload | null {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
