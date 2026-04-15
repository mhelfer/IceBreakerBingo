"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  clearFacilitatorSession,
  requireFacilitator,
  setSession,
} from "@/lib/session";
import { generateEventCode } from "@/lib/ids";

const emailSchema = z.string().email().max(254).transform((v) => v.toLowerCase().trim());
const passwordSchema = z.string().min(8).max(200);

export async function signUp(formData: FormData): Promise<void> {
  const emailResult = emailSchema.safeParse(formData.get("email"));
  const passwordResult = passwordSchema.safeParse(formData.get("password"));
  if (!emailResult.success || !passwordResult.success) {
    redirect("/admin/login?mode=signup&error=Invalid+email+or+password+(min+8+chars).");
  }
  const email = emailResult.data;
  const password = passwordResult.data;

  const supabase = getSupabaseAdmin();
  const existing = await supabase
    .from("facilitators")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing.error) {
    redirect("/admin/login?mode=signup&error=Something+went+wrong.+Try+again.");
  }
  if (existing.data) {
    redirect("/admin/login?mode=signup&error=An+account+with+that+email+already+exists.+Sign+in+instead.");
  }

  const password_hash = await hashPassword(password);
  const insert = await supabase
    .from("facilitators")
    .insert({ email, password_hash })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    redirect("/admin/login?mode=signup&error=Failed+to+create+account.+Try+again.");
  }

  await setSession({
    kind: "facilitator",
    facilitator_id: insert.data.id,
    iat: Math.floor(Date.now() / 1000),
  });
  redirect("/admin");
}

export async function signIn(formData: FormData): Promise<void> {
  const emailResult = emailSchema.safeParse(formData.get("email"));
  const rawPassword = formData.get("password");
  const password = typeof rawPassword === "string" ? rawPassword : "";
  if (!emailResult.success || password.length === 0) {
    redirect("/admin/login?error=Wrong+email+or+password.");
  }
  const email = emailResult.data;

  const supabase = getSupabaseAdmin();
  const row = await supabase
    .from("facilitators")
    .select("id, password_hash")
    .eq("email", email)
    .maybeSingle();
  if (row.error) {
    redirect("/admin/login?error=Something+went+wrong.+Try+again.");
  }
  if (!row.data || !(await verifyPassword(password, row.data.password_hash))) {
    redirect("/admin/login?error=Wrong+email+or+password.");
  }

  await setSession({
    kind: "facilitator",
    facilitator_id: row.data.id,
    iat: Math.floor(Date.now() / 1000),
  });
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  await clearFacilitatorSession();
  redirect("/admin/login");
}

const eventNameSchema = z.string().trim().min(1).max(120);
const codeSchema = z.string().trim().toUpperCase().min(4).max(12);

export async function createEvent(formData: FormData): Promise<void> {
  const session = await requireFacilitator();

  const name = eventNameSchema.parse(formData.get("name"));
  const startsAtRaw = formData.get("starts_at");
  const starts_at =
    typeof startsAtRaw === "string" && startsAtRaw.trim() !== ""
      ? new Date(startsAtRaw).toISOString()
      : null;

  const supabase = getSupabaseAdmin();

  // Retry a few times on unique-code collision (extremely rare in a fresh DB).
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateEventCode();
    const insert = await supabase
      .from("events")
      .insert({
        facilitator_id: session.facilitator_id,
        code,
        name,
        starts_at,
      })
      .select("code")
      .single();

    if (!insert.error && insert.data) {
      redirect(`/admin/${insert.data.code}`);
    }
    // 23505 = unique_violation. Retry on code collision; bail on anything else.
    if (insert.error && insert.error.code !== "23505") {
      throw new Error(insert.error.message);
    }
  }
  throw new Error("Could not allocate a unique event code. Try again.");
}

export async function deleteEvent(eventCode: string): Promise<void> {
  const session = await requireFacilitator();
  const code = codeSchema.parse(eventCode);
  const supabase = getSupabaseAdmin();

  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("code", code)
    .eq("facilitator_id", session.facilitator_id)
    .maybeSingle();
  if (!event) throw new Error("Event not found");

  // Walk the FK graph in dependency order to clear all RESTRICT references
  // before deleting the event. CASCADE handles the rest, but being explicit
  // guards against future schema changes that add new RESTRICT FKs.
  const { data: playerRows } = await supabase
    .from("players")
    .select("id")
    .eq("event_id", event.id);
  const playerIds = playerRows?.map((r) => r.id) ?? [];

  if (playerIds.length > 0) {
    const { data: cardRows } = await supabase
      .from("cards")
      .select("id")
      .in("player_id", playerIds);
    const cardIds = cardRows?.map((r) => r.id) ?? [];

    if (cardIds.length > 0) {
      const { data: claimRows } = await supabase
        .from("claims")
        .select("id")
        .in("card_id", cardIds);
      const claimIds = claimRows?.map((r) => r.id) ?? [];

      if (claimIds.length > 0) {
        // bingos.triggering_claim_id is RESTRICT — must go before claims
        const { error: e1 } = await supabase.from("bingos").delete().in("triggering_claim_id", claimIds);
        if (e1) throw new Error(`Delete bingos failed: ${e1.message}`);
        // claims.via_player_id and claims.trait_template_id are RESTRICT
        const { error: e2 } = await supabase.from("claims").delete().in("id", claimIds);
        if (e2) throw new Error(`Delete claims failed: ${e2.message}`);
      }
      // card_squares.trait_template_id is RESTRICT
      const { error: e3 } = await supabase.from("card_squares").delete().in("card_id", cardIds);
      if (e3) throw new Error(`Delete card_squares failed: ${e3.message}`);
    }

    // player_traits and survey_responses reference players (CASCADE) and
    // trait_templates/survey_questions (CASCADE), but delete explicitly so
    // ordering is unambiguous.
    const { error: e4 } = await supabase.from("player_traits").delete().in("player_id", playerIds);
    if (e4) throw new Error(`Delete player_traits failed: ${e4.message}`);
    const { error: e5 } = await supabase.from("survey_responses").delete().in("player_id", playerIds);
    if (e5) throw new Error(`Delete survey_responses failed: ${e5.message}`);
  }

  // prize_awards references event (CASCADE) — delete explicitly for clarity.
  const { error: e6 } = await supabase.from("prize_awards").delete().eq("event_id", event.id);
  if (e6) throw new Error(`Delete prize_awards failed: ${e6.message}`);

  const { error: e7 } = await supabase.from("events").delete().eq("id", event.id);
  if (e7) throw new Error(`Delete event failed: ${e7.message}`);
  redirect("/admin");
}
