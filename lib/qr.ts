// QR payload: plain-text, unguessable-by-structure, stable to copy-paste.
//
//   ibb:<event_code>:<player_id>:<qr_nonce>
//
// Event code narrows the scope; player_id identifies the scanned player;
// qr_nonce is the 96-bit random token that the server validates against
// `players.qr_nonce`. No signing — the nonce is the capability. If a
// nonce leaks the facilitator can re-mint via the player's access-code
// flow (which rotates qr_nonce on the way through).

export type QrPayload = {
  eventCode: string;
  playerId: string;
  qrNonce: string;
};

const PREFIX = "ibb:";

export function encodeQrPayload(p: QrPayload): string {
  return `${PREFIX}${p.eventCode}:${p.playerId}:${p.qrNonce}`;
}

export function decodeQrPayload(raw: string): QrPayload | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith(PREFIX)) return null;
  const parts = trimmed.slice(PREFIX.length).split(":");
  if (parts.length !== 3) return null;
  const [eventCode, playerId, qrNonce] = parts;
  if (!eventCode || !playerId || !qrNonce) return null;
  return { eventCode, playerId, qrNonce };
}
