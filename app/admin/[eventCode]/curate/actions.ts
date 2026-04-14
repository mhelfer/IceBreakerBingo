"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requireFacilitator } from "@/lib/session";

const codeSchema = z
  .string()
  .trim()
  .min(4)
  .max(12)
  .transform((v) => v.toUpperCase());

const uuidSchema = z.string().uuid();

async function loadOwnedEvent(eventCode: string) {
  const session = await requireFacilitator();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("events")
    .select("id, code, state, facilitator_id")
    .eq("code", codeSchema.parse(eventCode))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("EVENT_NOT_FOUND");
  if (data.facilitator_id !== session.facilitator_id) {
    throw new Error("EVENT_NOT_FOUND");
  }
  return { supabase, event: data };
}

async function assertTraitBelongsToEvent(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  eventId: string,
  traitId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("trait_templates")
    .select("id, event_id")
    .eq("id", traitId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.event_id !== eventId) {
    throw new Error("Trait not found.");
  }
}

function assertEditable(state: string): void {
  if (state !== "survey_closed") {
    throw new Error(`Traits are editable only in survey_closed (got ${state}).`);
  }
}

const squareTextSchema = z.string().trim().min(1).max(36);
const promptSchema = z.string().trim().min(1).max(200);

export async function updateTraitSquareText(
  eventCode: string,
  traitId: string,
  formData: FormData,
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  assertEditable(event.state);
  const id = uuidSchema.parse(traitId);
  const square_text = squareTextSchema.parse(formData.get("square_text"));

  await assertTraitBelongsToEvent(supabase, event.id, id);

  const { error } = await supabase
    .from("trait_templates")
    .update({ square_text })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${event.code}/curate`);
}

export async function updateTraitPrompt(
  eventCode: string,
  traitId: string,
  formData: FormData,
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  assertEditable(event.state);
  const id = uuidSchema.parse(traitId);
  const conversation_prompt = promptSchema.parse(
    formData.get("conversation_prompt"),
  );

  await assertTraitBelongsToEvent(supabase, event.id, id);

  const { error } = await supabase
    .from("trait_templates")
    .update({ conversation_prompt })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${event.code}/curate`);
}

export async function setTraitEnabled(
  eventCode: string,
  traitId: string,
  enabled: boolean,
): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  assertEditable(event.state);
  const id = uuidSchema.parse(traitId);

  await assertTraitBelongsToEvent(supabase, event.id, id);

  const { error } = await supabase
    .from("trait_templates")
    .update({ enabled })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${event.code}/curate`);
}

export async function lockCuration(eventCode: string): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "survey_closed") {
    throw new Error(`Can't lock curation from state ${event.state}.`);
  }
  const { error } = await supabase
    .from("events")
    .update({
      state: "curation_locked",
      curation_locked_at: new Date().toISOString(),
    })
    .eq("id", event.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${event.code}/curate`);
  revalidatePath(`/admin/${event.code}`);
}

export async function unlockCuration(eventCode: string): Promise<void> {
  const { supabase, event } = await loadOwnedEvent(eventCode);
  if (event.state !== "curation_locked") {
    throw new Error(`Can't unlock from state ${event.state}.`);
  }
  const { error } = await supabase
    .from("events")
    .update({ state: "survey_closed", curation_locked_at: null })
    .eq("id", event.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/${event.code}/curate`);
  revalidatePath(`/admin/${event.code}`);
}
