import { redirect } from "next/navigation";
import { readPlayerSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { PlayerTabs } from "../PlayerTabs";
import { Scanner } from "./Scanner";

export const dynamic = "force-dynamic";

export default async function PlayerScanPage() {
  const session = await readPlayerSession();
  if (!session) redirect("/p/link-invalid");

  const supabase = getSupabaseAdmin();
  const { data: event } = await supabase
    .from("events")
    .select("state")
    .eq("id", session.event_id)
    .maybeSingle();
  if (!event) redirect("/p/link-invalid");
  if (event.state !== "live") redirect("/p/not-yet");

  return (
    <main className="mx-auto max-w-md px-4 pt-5 pb-28">
      <header className="mb-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Scan a teammate
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Aim at their <span className="font-medium text-zinc-700">My QR</span>{" "}
          screen and hold steady.
        </p>
      </header>
      <Scanner />
      <PlayerTabs active="scan" />
    </main>
  );
}
