import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  decodeSession,
  encodeSession,
  type SessionPayload,
} from "./session-token";

export { encodeSession, decodeSession } from "./session-token";
export type { SessionPayload } from "./session-token";

export async function setSession(payload: SessionPayload): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, encodeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  return decodeSession(raw);
}

export async function requireFacilitator(): Promise<
  Extract<SessionPayload, { kind: "facilitator" }>
> {
  const s = await readSession();
  if (!s || s.kind !== "facilitator") throw new Error("FACILITATOR_REQUIRED");
  return s;
}

export async function requirePlayer(): Promise<
  Extract<SessionPayload, { kind: "player" }>
> {
  const s = await readSession();
  if (!s || s.kind !== "player") throw new Error("PLAYER_REQUIRED");
  return s;
}
