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
  const email = emailSchema.parse(formData.get("email"));
  const password = passwordSchema.parse(formData.get("password"));

  const supabase = getSupabaseAdmin();
  const existing = await supabase
    .from("facilitators")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing.data) {
    throw new Error("An account with that email already exists. Sign in instead.");
  }

  const password_hash = await hashPassword(password);
  const insert = await supabase
    .from("facilitators")
    .insert({ email, password_hash })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    throw new Error(insert.error?.message ?? "Failed to create account");
  }

  await setSession({
    kind: "facilitator",
    facilitator_id: insert.data.id,
    iat: Math.floor(Date.now() / 1000),
  });
  redirect("/admin");
}

export async function signIn(formData: FormData): Promise<void> {
  const email = emailSchema.parse(formData.get("email"));
  const password = passwordSchema.parse(formData.get("password"));

  const supabase = getSupabaseAdmin();
  const row = await supabase
    .from("facilitators")
    .select("id, password_hash")
    .eq("email", email)
    .maybeSingle();
  if (!row.data || !(await verifyPassword(password, row.data.password_hash))) {
    throw new Error("Wrong email or password.");
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
