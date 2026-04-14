import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readSession } from "@/lib/session";
import { createEvent, signOut } from "./actions";

export const dynamic = "force-dynamic";

type EventRow = {
  code: string;
  name: string;
  state: string;
  starts_at: string | null;
  created_at: string;
};

export default async function AdminIndexPage() {
  const session = await readSession();
  if (!session || session.kind !== "facilitator") {
    redirect("/admin/login");
  }

  const supabase = getSupabaseAdmin();
  const { data: events, error } = await supabase
    .from("events")
    .select("code, name, state, starts_at, created_at")
    .eq("facilitator_id", session.facilitator_id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your events</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-zinc-500 hover:text-zinc-900 underline"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="mt-8 rounded border border-zinc-200 p-4">
        <h2 className="text-lg font-medium">New event</h2>
        <form action={createEvent} className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>Name</span>
            <input
              name="name"
              required
              maxLength={120}
              placeholder="Q2 Eng Offsite"
              className="rounded border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Starts at (optional)</span>
            <input
              name="starts_at"
              type="datetime-local"
              className="rounded border border-zinc-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="self-start rounded bg-black px-4 py-2 text-white hover:bg-zinc-800"
          >
            Create event
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">All events</h2>
        {(events as EventRow[] | null)?.length ? (
          <ul className="mt-3 divide-y divide-zinc-200 rounded border border-zinc-200">
            {(events as EventRow[]).map((e) => (
              <li key={e.code} className="p-4">
                <a
                  href={`/admin/${e.code}`}
                  className="flex items-baseline justify-between gap-4"
                >
                  <span className="font-medium">{e.name}</span>
                  <span className="font-mono text-sm text-zinc-500">
                    {e.code} · {e.state}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No events yet.</p>
        )}
      </section>
    </main>
  );
}
