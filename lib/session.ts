import { cookies } from "next/headers";
import {
  FACILITATOR_COOKIE_NAME,
  PLAYER_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  decodeSession,
  encodeSession,
  type SessionPayload,
} from "./session-token";

export { encodeSession, decodeSession } from "./session-token";
export type { SessionPayload } from "./session-token";

type FacilitatorSession = Extract<SessionPayload, { kind: "facilitator" }>;
type PlayerSession = Extract<SessionPayload, { kind: "player" }>;

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

export async function setSession(payload: SessionPayload): Promise<void> {
  const store = await cookies();
  const name =
    payload.kind === "facilitator"
      ? FACILITATOR_COOKIE_NAME
      : PLAYER_COOKIE_NAME;
  store.set(name, encodeSession(payload), COOKIE_OPTS);
}

export async function clearFacilitatorSession(): Promise<void> {
  (await cookies()).delete(FACILITATOR_COOKIE_NAME);
}

export async function clearPlayerSession(): Promise<void> {
  (await cookies()).delete(PLAYER_COOKIE_NAME);
}

export async function readFacilitatorSession(): Promise<FacilitatorSession | null> {
  const store = await cookies();
  const raw = store.get(FACILITATOR_COOKIE_NAME)?.value;
  if (!raw) return null;
  const s = decodeSession(raw);
  return s && s.kind === "facilitator" ? s : null;
}

export async function readPlayerSession(): Promise<PlayerSession | null> {
  const store = await cookies();
  const raw = store.get(PLAYER_COOKIE_NAME)?.value;
  if (!raw) return null;
  const s = decodeSession(raw);
  return s && s.kind === "player" ? s : null;
}

export async function requireFacilitator(): Promise<FacilitatorSession> {
  const s = await readFacilitatorSession();
  if (!s) throw new Error("FACILITATOR_REQUIRED");
  return s;
}

export async function requirePlayer(): Promise<PlayerSession> {
  const s = await readPlayerSession();
  if (!s) throw new Error("PLAYER_REQUIRED");
  return s;
}
