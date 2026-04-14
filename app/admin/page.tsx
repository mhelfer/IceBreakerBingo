import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarClock, LogOut, Users } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readFacilitatorSession } from "@/lib/session";
import { buttonClass } from "@/app/components/ui/Button";
import { Card } from "@/app/components/ui/Card";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { StatePill, type EventState } from "@/app/components/ui/StatePill";
import { signOut } from "./actions";
import { NewEventDialog } from "./NewEventDialog";

export const dynamic = "force-dynamic";

type EventRow = {
  id: string;
  code: string;
  name: string;
  state: EventState;
  starts_at: string | null;
  created_at: string;
};

export default async function AdminIndexPage() {
  const session = await readFacilitatorSession();
  if (!session) redirect("/admin/login");

  const supabase = getSupabaseAdmin();
  const { data: events, error } = await supabase
    .from("events")
    .select("id, code, name, state, starts_at, created_at")
    .eq("facilitator_id", session.facilitator_id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const list = (events ?? []) as EventRow[];

  const { data: playerRows } = await supabase
    .from("players")
    .select("event_id")
    .in("event_id", list.map((e) => e.id));
  const playerCounts = new Map<string, number>();
  for (const p of playerRows ?? []) {
    playerCounts.set(p.event_id, (playerCounts.get(p.event_id) ?? 0) + 1);
  }

  return (
    <div className="min-h-screen bg-zinc-50/40">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
              IceBreaker Bingo
            </h1>
            <p className="text-xs text-zinc-500">Facilitator dashboard</p>
          </div>
          <form action={signOut}>
            <button type="submit" className={buttonClass("ghost", "sm")}>
              <LogOut size={13} /> Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Your events
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {list.length === 0
                ? "No events yet — create one to get started."
                : `${list.length} ${list.length === 1 ? "event" : "events"}`}
            </p>
          </div>
          <NewEventDialog />
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={18} />}
            title="No events yet"
            body="Spin up your first icebreaker bingo event — we'll handle the rest."
            action={<NewEventDialog />}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {list.map((e) => (
              <li key={e.code}>
                <Link
                  href={`/admin/${e.code}`}
                  className="group block h-full"
                >
                  <Card className="h-full p-4 transition hover:border-zinc-300 hover:shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-zinc-900">
                          {e.name}
                        </h3>
                        <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                          {e.code}
                        </p>
                      </div>
                      <StatePill state={e.state} />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        <Users size={12} />
                        {playerCounts.get(e.id) ?? 0} players
                      </span>
                      {e.starts_at ? (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock size={12} />
                          {new Date(e.starts_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : (
                        <span className="text-zinc-400">No start time</span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-end text-xs font-medium text-zinc-500 transition group-hover:text-zinc-900">
                      Open <ArrowRight size={12} className="ml-1" />
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

