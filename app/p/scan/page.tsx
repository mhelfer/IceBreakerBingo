import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { PlayerTabs } from "../PlayerTabs";
import { Scanner } from "./Scanner";

export const dynamic = "force-dynamic";

export default async function PlayerScanPage() {
  const session = await readSession();
  if (!session || session.kind !== "player") redirect("/p/link-invalid");

  const supabase = getSupabaseAdmin();
  const { data: event } = await supabase
    .from("events")
    .select("state")
    .eq("id", session.event_id)
    .maybeSingle();
  if (!event) redirect("/p/link-invalid");
  if (event.state !== "live") redirect("/p/not-yet");

  return (
    <main className="mx-auto max-w-md px-4 pb-20 pt-4">
      <header className="mb-3">
        <h1 className="text-base font-semibold">Scan a teammate</h1>
      </header>
      <Scanner />
      <PlayerTabs active="scan" />
    </main>
  );
}
