import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  completeLines,
  isBlackout,
  type BingoLineType,
} from "@/lib/prizes";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  position: z.number().int().min(0).max(24),
  scannedPlayerId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

type Reveal = {
  squareText: string;
  conversationPrompt: string; // synthesized for discovery
  kind: "cohort" | "discovery";
  viaDisplayName: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// Live-prize mapping: one bingo → one live prize, guarded by unique index
// on (event_id, prize) for the first_* prizes.
function livePrizeFor(lineType: BingoLineType): "first_across" | "first_down" | "first_diagonal" {
  if (lineType === "row") return "first_across";
  if (lineType === "col") return "first_down";
  return "first_diagonal";
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session || session.kind !== "player") {
    return bad("not a player session", 401);
  }

  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return bad("invalid body");
  }
  if (body.position === 12) return bad("cannot claim the free space");

  const supabase = getSupabaseAdmin();

  // Event must be live.
  const { data: event } = await supabase
    .from("events")
    .select("id, state, reuse_unlocked")
    .eq("id", session.event_id)
    .maybeSingle();
  if (!event) return bad("event not found", 404);
  if (event.state !== "live") {
    return bad(`claims are closed (state=${event.state})`, 409);
  }

  // Scanner's card + the specific square being claimed.
  const { data: card } = await supabase
    .from("cards")
    .select("id, player_id")
    .eq("player_id", session.player_id)
    .maybeSingle();
  if (!card) return bad("no card for this player", 404);

  const { data: square } = await supabase
    .from("card_squares")
    .select(
      "card_id, position, trait_template_id, trait_templates(id, kind, question_id, square_text, conversation_prompt)",
    )
    .eq("card_id", card.id)
    .eq("position", body.position)
    .maybeSingle();
  if (!square || !square.trait_template_id) {
    return bad("no trait at that square", 404);
  }
  const template = Array.isArray(square.trait_templates)
    ? square.trait_templates[0]
    : square.trait_templates;
  if (!template) return bad("trait lookup failed", 500);

  // Idempotency: same key → original claim returned verbatim.
  const { data: existing } = await supabase
    .from("claims")
    .select("id, position, via_player_id, trait_template_id")
    .eq("card_id", card.id)
    .eq("idempotency_key", body.idempotencyKey)
    .maybeSingle();
  if (existing) {
    const reveal = await buildReveal(
      supabase,
      existing.via_player_id,
      template,
    );
    const bingoCount = await countBingos(supabase, card.id);
    return NextResponse.json({
      ok: true,
      claimed: true,
      bingo: bingoCount > 0,
      reveal,
      duplicate: true,
    });
  }

  // Validate: scanned player is in event, not self, and actually matches.
  if (body.scannedPlayerId === session.player_id) {
    return bad("cannot claim via yourself");
  }
  const { data: scanned } = await supabase
    .from("players")
    .select("id, display_name, event_id")
    .eq("id", body.scannedPlayerId)
    .maybeSingle();
  if (!scanned || scanned.event_id !== event.id) {
    return bad("scanned player not in this event", 404);
  }

  const { data: trait } = await supabase
    .from("player_traits")
    .select("trait_template_id")
    .eq("player_id", scanned.id)
    .eq("trait_template_id", template.id)
    .maybeSingle();
  if (!trait) return bad("that teammate does not match this square");

  // Reuse policy: pre-unlock, each teammate can satisfy at most one square.
  if (!event.reuse_unlocked) {
    const { data: reusedClaim } = await supabase
      .from("claims")
      .select("id")
      .eq("card_id", card.id)
      .eq("via_player_id", scanned.id)
      .limit(1)
      .maybeSingle();
    if (reusedClaim) {
      return bad("teammate already used — reuse is locked", 409);
    }
  }

  // Insert the claim. unique(card_id, position) catches races.
  const { error: insertErr } = await supabase.from("claims").insert({
    card_id: card.id,
    position: body.position,
    via_player_id: scanned.id,
    trait_template_id: template.id,
    idempotency_key: body.idempotencyKey,
  });
  if (insertErr) {
    // 23505 = unique violation → someone else claimed this square first.
    if (insertErr.code === "23505") {
      return bad("square already claimed", 409);
    }
    return bad(insertErr.message, 500);
  }

  // Re-read the canonical claim id for bingo linkage.
  const { data: justInserted } = await supabase
    .from("claims")
    .select("id")
    .eq("card_id", card.id)
    .eq("position", body.position)
    .single();
  if (!justInserted) return bad("claim readback failed", 500);

  // Detect bingos + blackout using all claims on this card (+ free space).
  const { data: allClaims } = await supabase
    .from("claims")
    .select("position")
    .eq("card_id", card.id);
  const positions = new Set((allClaims ?? []).map((c) => c.position));

  const lines = completeLines(positions);
  const newBingos = await insertNewBingos(
    supabase,
    card.id,
    session.player_id,
    justInserted.id,
    lines,
  );

  // Live-prize awards (unique partial index silently drops duplicates).
  for (const b of newBingos) {
    await supabase.from("prize_awards").insert({
      event_id: event.id,
      prize: livePrizeFor(b.line_type),
      player_id: session.player_id,
    });
  }
  if (isBlackout(positions)) {
    await supabase.from("prize_awards").insert({
      event_id: event.id,
      prize: "first_blackout",
      player_id: session.player_id,
    });
  }

  const reveal = await buildReveal(supabase, scanned.id, template);
  const anyBingo = (await countBingos(supabase, card.id)) > 0;

  return NextResponse.json({
    ok: true,
    claimed: true,
    bingo: anyBingo,
    newLines: newBingos.map((b) => ({
      line_type: b.line_type,
      line_index: b.line_index,
    })),
    reveal,
  });
}

async function countBingos(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  cardId: string,
): Promise<number> {
  const { count } = await supabase
    .from("bingos")
    .select("id", { count: "exact", head: true })
    .eq("card_id", cardId);
  return count ?? 0;
}

async function insertNewBingos(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  cardId: string,
  playerId: string,
  triggeringClaimId: string,
  lines: { line_type: BingoLineType; line_index: number }[],
): Promise<{ line_type: BingoLineType; line_index: number }[]> {
  if (lines.length === 0) return [];
  // unique(card_id, line_type, line_index) means second-time lines are
  // silently rejected. Insert one-by-one so partial success is clean.
  const accepted: { line_type: BingoLineType; line_index: number }[] = [];
  for (const ln of lines) {
    const { error } = await supabase.from("bingos").insert({
      card_id: cardId,
      player_id: playerId,
      line_type: ln.line_type,
      line_index: ln.line_index,
      triggering_claim_id: triggeringClaimId,
    });
    if (!error) accepted.push(ln);
  }
  return accepted;
}

async function buildReveal(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  viaPlayerId: string,
  template: {
    id: string;
    kind: "cohort" | "discovery";
    question_id: string;
    square_text: string;
    conversation_prompt: string | null;
  },
): Promise<Reveal> {
  const { data: via } = await supabase
    .from("players")
    .select("display_name")
    .eq("id", viaPlayerId)
    .single();
  const viaName = via?.display_name ?? "Teammate";

  if (template.kind === "cohort") {
    return {
      squareText: template.square_text,
      conversationPrompt:
        template.conversation_prompt ?? `Chat with ${viaName}.`,
      kind: "cohort",
      viaDisplayName: viaName,
    };
  }

  // Discovery: synthesize the prompt from the scanned player's free-text answer.
  const { data: resp } = await supabase
    .from("survey_responses")
    .select("value")
    .eq("player_id", viaPlayerId)
    .eq("question_id", template.question_id)
    .maybeSingle();
  const raw = resp?.value;
  const answer = typeof raw === "string" ? raw.trim() : "";
  const prompt = answer
    ? `Ask ${viaName} about "${answer}".`
    : `Ask ${viaName} — they had something to share.`;
  return {
    squareText: template.square_text,
    conversationPrompt: prompt,
    kind: "discovery",
    viaDisplayName: viaName,
  };
}
