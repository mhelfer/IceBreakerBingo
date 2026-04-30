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
  if (event.state !== "live" && event.state !== "paused") {
    redirect("/p/not-yet");
  }

  const isPaused = event.state === "paused";

  return (
    <main className="mx-auto max-w-md px-4 pt-5 pb-28">
      <header className="mb-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Scan a teammate
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          {isPaused ? (
            "Scanning is paused right now."
          ) : (
            <>
              Aim at their{" "}
              <span className="font-medium text-zinc-700">My QR</span> screen
              and hold steady.
            </>
          )}
        </p>
      </header>
      {isPaused ? (
        <div className="mx-auto max-w-sm rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-900">
          <p className="font-medium">Game paused</p>
          <p className="mt-1 text-amber-800">
            Your facilitator paused scanning. Refresh this page when the game
            picks back up.
          </p>
        </div>
      ) : (
        <Scanner />
      )}
      <PlayerTabs active="scan" />
    </main>
  );
}
