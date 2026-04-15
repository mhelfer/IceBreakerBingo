import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readPlayerSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { decodeQrPayload } from "@/lib/qr";
import {
  computeScanEligibility,
  type CardSquareInfo,
  type ClaimInfo,
} from "@/lib/eligibility";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  qrText: z.string().min(1).max(512),
});

type Body = z.infer<typeof bodySchema>;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  const session = await readPlayerSession();
  if (!session) return bad("not a player session", 401);

  let body: Body;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return bad("invalid body");
  }

  const payload = decodeQrPayload(body.qrText);
  if (!payload) return bad("unreadable qr");

  if (payload.playerId === session.player_id) {
    return bad("cannot scan yourself");
  }

  const supabase = getSupabaseAdmin();

  const { data: event } = await supabase
    .from("events")
    .select("id, code, state, reuse_unlocked, show_all_matches")
    .eq("id", session.event_id)
    .maybeSingle();
  if (!event) return bad("event not found", 404);
  if (event.code !== payload.eventCode) {
    return bad("qr belongs to a different event");
  }
  if (event.state !== "live") {
    return bad(`scans are closed (state=${event.state})`, 409);
  }

  const { data: scanned } = await supabase
    .from("players")
    .select("id, display_name, event_id, qr_nonce, absent")
    .eq("id", payload.playerId)
    .maybeSingle();
  if (!scanned || scanned.event_id !== event.id) {
    return bad("scanned player not in this event", 404);
  }
  if (scanned.absent) {
    return bad("that player is marked absent");
  }
  const nonceA = Buffer.from(scanned.qr_nonce);
  const nonceB = Buffer.from(payload.qrNonce);
  if (nonceA.length !== nonceB.length || !timingSafeEqual(nonceA, nonceB)) {
    return bad("qr nonce mismatch — ask for a fresh qr");
  }

  const { data: card } = await supabase
    .from("cards")
    .select("id")
    .eq("player_id", session.player_id)
    .maybeSingle();
  if (!card) return bad("no card for this player", 404);

  const [{ data: squareRows }, { data: claimRows }, { data: traitRows }] =
    await Promise.all([
      supabase
        .from("card_squares")
        .select("position, trait_template_id")
        .eq("card_id", card.id),
      supabase
        .from("claims")
        .select("position, via_player_id")
        .eq("card_id", card.id),
      supabase
        .from("player_traits")
        .select("trait_template_id")
        .eq("player_id", scanned.id),
    ]);

  const scannerSquares: CardSquareInfo[] = (squareRows ?? []).map((s) => ({
    position: s.position,
    traitTemplateId: s.trait_template_id,
  }));
  const scannerClaims: ClaimInfo[] = (claimRows ?? []).map((c) => ({
    position: c.position,
    viaPlayerId: c.via_player_id,
  }));
  const scannedPlayerTraitIds = new Set(
    (traitRows ?? []).map((t) => t.trait_template_id),
  );

  const result = computeScanEligibility({
    scannerSquares,
    scannerClaims,
    scannedPlayerId: scanned.id,
    scannedPlayerTraitIds,
    reuseUnlocked: event.reuse_unlocked,
  });

  // Enrich eligible positions with square metadata for the client picker.
  const squaresByPos = new Map(
    scannerSquares.map((s) => [s.position, s.traitTemplateId]),
  );

  let traitMeta: Map<string, { kind: string; square_text: string }> = new Map();
  if (result.kind === "eligible") {
    const ids = result.positions
      .map((p) => squaresByPos.get(p))
      .filter((x): x is string => typeof x === "string");
    const { data: metas } = await supabase
      .from("trait_templates")
      .select("id, kind, square_text")
      .in("id", ids);
    traitMeta = new Map(
      (metas ?? []).map((m) => [m.id, { kind: m.kind, square_text: m.square_text }]),
    );
  }

  let tiles =
    result.kind === "eligible"
      ? result.positions.map((pos) => {
          const traitId = squaresByPos.get(pos);
          const meta = traitId ? traitMeta.get(traitId) : undefined;
          return {
            position: pos,
            traitTemplateId: traitId ?? null,
            squareText: meta?.square_text ?? "",
            kind: meta?.kind ?? "cohort",
          };
        })
      : [];

  // Auto-select: return 1 random eligible tile unless facilitator enabled show-all.
  if (!event.show_all_matches && tiles.length > 1) {
    tiles = [tiles[Math.floor(Math.random() * tiles.length)]];
  }

  return NextResponse.json({
    ok: true,
    scanned: { id: scanned.id, displayName: scanned.display_name },
    result: result.kind,
    eligibleTiles: tiles,
  });
}
