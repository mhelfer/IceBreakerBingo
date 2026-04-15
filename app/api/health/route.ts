import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    // Lightweight connectivity check — no admin APIs, no data leaked.
    const { error } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .limit(0);

    if (error) {
      return Response.json(
        { ok: false, error: "db unreachable" },
        { status: 500 },
      );
    }

    return Response.json({ ok: true, supabase: "connected" });
  } catch {
    return Response.json(
      { ok: false, error: "db unreachable" },
      { status: 500 },
    );
  }
}
