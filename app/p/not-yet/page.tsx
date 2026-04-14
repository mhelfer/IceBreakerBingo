import { readSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NotYetPage() {
  const session = await readSession();
  let name: string | null = null;
  let eventName: string | null = null;
  let startsAt: string | null = null;
  if (session?.kind === "player") {
    const supabase = getSupabaseAdmin();
    const { data: p } = await supabase
      .from("players")
      .select("display_name, events(name, starts_at)")
      .eq("id", session.player_id)
      .maybeSingle();
    if (p) {
      name = p.display_name;
      const ev = Array.isArray(p.events) ? p.events[0] : p.events;
      eventName = ev?.name ?? null;
      startsAt = ev?.starts_at ?? null;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl">
        {name ? <>Hi, {name} 👋</> : "IceBreaker Bingo"}
      </h1>
      {eventName ? (
        <p className="mt-4 text-sm text-zinc-600">
          {eventName}
          {startsAt ? (
            <>
              {" "}starts{" "}
              <time dateTime={startsAt}>
                {new Date(startsAt).toLocaleString()}
              </time>
            </>
          ) : null}
          .
        </p>
      ) : null}
      <p className="mt-6 text-sm text-zinc-600">
        Re-open this link when the game starts.
      </p>
      <p className="mt-6 text-xs text-zinc-400">
        This link is personal — please don't share it.
      </p>
    </main>
  );
}
