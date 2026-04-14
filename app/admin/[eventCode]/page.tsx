import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readSession } from "@/lib/session";
import {
  addQuestion,
  addQuestionOption,
  clearRoster,
  closeSurvey,
  deleteQuestion,
  forkStarterQuestions,
  moveQuestion,
  openSurvey,
  remintAccessCode,
  removeQuestionOption,
  reopenSurvey,
  updateQuestionPrompt,
  uploadRoster,
} from "./actions";

export const dynamic = "force-dynamic";

type PlayerRow = {
  id: string;
  display_name: string;
  contact_handle: string | null;
  survey_submitted_at: string | null;
  access_code: string;
};

type QuestionRow = {
  id: string;
  prompt: string;
  type: "single" | "multi" | "binary" | "text" | "numeric_bucket";
  options: string[] | null;
  position: number;
};

export default async function EventDashboardPage({
  params,
}: {
  params: Promise<{ eventCode: string }>;
}) {
  const session = await readSession();
  if (!session || session.kind !== "facilitator") redirect("/admin/login");

  const { eventCode } = await params;
  const codeUpper = eventCode.toUpperCase();
  const supabase = getSupabaseAdmin();
  const { data: event, error } = await supabase
    .from("events")
    .select("id, code, name, state, starts_at, reuse_unlocked")
    .eq("code", codeUpper)
    .eq("facilitator_id", session.facilitator_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!event) notFound();

  const [{ data: players }, { data: questions }] = await Promise.all([
    supabase
      .from("players")
      .select("id, display_name, contact_handle, survey_submitted_at, access_code")
      .eq("event_id", event.id)
      .order("display_name"),
    supabase
      .from("survey_questions")
      .select("id, prompt, type, options, position")
      .eq("event_id", event.id)
      .order("position"),
  ]);

  const roster = (players ?? []) as PlayerRow[];
  const qs = (questions ?? []) as QuestionRow[];
  const rosterLocked = event.state !== "draft";
  const canReorder = event.state === "draft";
  const canEditPrompts =
    event.state === "draft" || event.state === "survey_open";
  const canAddOption =
    event.state === "draft" || event.state === "survey_open";
  const canRemoveOption = event.state === "draft";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav className="text-sm">
        <a href="/admin" className="text-zinc-500 hover:text-zinc-900">
          ← All events
        </a>
      </nav>
      <header className="mt-4 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">{event.name}</h1>
        <div className="font-mono text-sm text-zinc-500">
          {event.code} · {event.state}
        </div>
      </header>

      <section className="mt-8 rounded border border-zinc-200 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">
            Roster{" "}
            <span className="text-sm text-zinc-500">({roster.length})</span>
          </h2>
          {rosterLocked ? (
            <span className="text-xs text-zinc-500">
              Locked — state is {event.state}
            </span>
          ) : null}
        </div>

        {roster.length > 0 ? (
          <ul className="mt-3 divide-y divide-zinc-200 rounded border border-zinc-200 bg-white">
            {roster.map((p) => (
              <li
                key={p.id}
                className="flex items-baseline justify-between px-3 py-2 text-sm"
              >
                <span>{p.display_name}</span>
                <span className="font-mono text-xs text-zinc-500">
                  {p.contact_handle ?? "—"}
                  {p.survey_submitted_at ? " ✓" : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">Roster is empty.</p>
        )}

        {!rosterLocked ? (
          <>
            <form
              action={uploadRoster.bind(null, event.code)}
              className="mt-4 flex flex-col gap-2"
            >
              <label className="flex flex-col gap-1 text-sm">
                <span>
                  Paste CSV —{" "}
                  <span className="font-mono">display_name, contact_handle</span>
                </span>
                <textarea
                  name="csv"
                  rows={6}
                  required
                  className="rounded border border-zinc-300 px-3 py-2 font-mono text-xs"
                  placeholder={"Alice Chen, @alice\nBob Park, @bpark"}
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded bg-black px-4 py-2 text-white hover:bg-zinc-800"
                >
                  {roster.length > 0 ? "Replace roster" : "Upload roster"}
                </button>
              </div>
            </form>
            {roster.length > 0 ? (
              <form action={clearRoster.bind(null, event.code)} className="mt-2">
                <button
                  type="submit"
                  className="text-sm text-zinc-500 underline hover:text-zinc-900"
                >
                  Clear roster
                </button>
              </form>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="mt-6 rounded border border-zinc-200 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">
            Questions <span className="text-sm text-zinc-500">({qs.length})</span>
          </h2>
          {!canEditPrompts ? (
            <span className="text-xs text-zinc-500">
              Frozen — state is {event.state}
            </span>
          ) : null}
        </div>

        {qs.length === 0 ? (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm text-zinc-500">No questions yet.</p>
            {event.state === "draft" ? (
              <form action={forkStarterQuestions.bind(null, event.code)}>
                <button
                  type="submit"
                  className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
                >
                  Load starter template (12 questions)
                </button>
              </form>
            ) : null}
          </div>
        ) : (
          <ol className="mt-3 flex flex-col gap-3">
            {qs.map((q, idx) => (
              <li
                key={q.id}
                className="rounded border border-zinc-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-zinc-400">
                        {idx + 1}.
                      </span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
                        {q.type}
                      </span>
                    </div>
                    {canEditPrompts ? (
                      <form
                        action={updateQuestionPrompt.bind(
                          null,
                          event.code,
                          q.id,
                        )}
                        className="mt-1 flex gap-2"
                      >
                        <input
                          name="prompt"
                          defaultValue={q.prompt}
                          required
                          className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
                        />
                        <button
                          type="submit"
                          className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                        >
                          Save
                        </button>
                      </form>
                    ) : (
                      <p className="mt-1 text-sm">{q.prompt}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {canReorder ? (
                      <>
                        <form
                          action={moveQuestion.bind(
                            null,
                            event.code,
                            q.id,
                            "up",
                          )}
                        >
                          <button
                            type="submit"
                            disabled={idx === 0}
                            className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs disabled:opacity-30 hover:bg-zinc-50"
                          >
                            ↑
                          </button>
                        </form>
                        <form
                          action={moveQuestion.bind(
                            null,
                            event.code,
                            q.id,
                            "down",
                          )}
                        >
                          <button
                            type="submit"
                            disabled={idx === qs.length - 1}
                            className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs disabled:opacity-30 hover:bg-zinc-50"
                          >
                            ↓
                          </button>
                        </form>
                        <form
                          action={deleteQuestion.bind(
                            null,
                            event.code,
                            q.id,
                          )}
                        >
                          <button
                            type="submit"
                            className="rounded border border-zinc-200 px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
                          >
                            ✕
                          </button>
                        </form>
                      </>
                    ) : null}
                  </div>
                </div>

                {q.type !== "text" && q.options ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {q.options.map((opt) => (
                      <span
                        key={opt}
                        className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs"
                      >
                        {opt}
                        {canRemoveOption && q.type !== "binary" ? (
                          <form
                            action={removeQuestionOption.bind(
                              null,
                              event.code,
                              q.id,
                              opt,
                            )}
                          >
                            <button
                              type="submit"
                              className="text-zinc-400 hover:text-red-600"
                              aria-label={`Remove ${opt}`}
                            >
                              ×
                            </button>
                          </form>
                        ) : null}
                      </span>
                    ))}
                    {canAddOption && q.type !== "binary" ? (
                      <form
                        action={addQuestionOption.bind(
                          null,
                          event.code,
                          q.id,
                        )}
                        className="inline-flex items-center gap-1"
                      >
                        <input
                          name="option"
                          placeholder="Add option"
                          required
                          className="w-32 rounded border border-zinc-300 px-2 py-0.5 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs hover:bg-zinc-50"
                        >
                          +
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}

        {canEditPrompts ? (
          <details className="mt-4 rounded border border-zinc-200 bg-zinc-50 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              + Add a question
            </summary>
            <form
              action={addQuestion.bind(null, event.code)}
              className="mt-3 flex flex-col gap-2"
            >
              <label className="flex flex-col gap-1 text-sm">
                <span>Prompt</span>
                <input
                  name="prompt"
                  required
                  maxLength={200}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Type</span>
                <select
                  name="type"
                  defaultValue="text"
                  className="rounded border border-zinc-300 px-2 py-1 text-sm"
                >
                  <option value="text">text (free response)</option>
                  <option value="single">single (pick one)</option>
                  <option value="multi">multi (pick many)</option>
                  <option value="binary">binary (2 choices)</option>
                  <option value="numeric_bucket">numeric_bucket</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Options (one per line, required for non-text)</span>
                <textarea
                  name="options"
                  rows={4}
                  className="rounded border border-zinc-300 px-2 py-1 font-mono text-xs"
                  placeholder={"Option A\nOption B"}
                />
              </label>
              <div>
                <button
                  type="submit"
                  className="rounded bg-black px-3 py-1.5 text-sm text-white hover:bg-zinc-800"
                >
                  Add question
                </button>
              </div>
            </form>
          </details>
        ) : null}
      </section>

      <StateSection
        eventCode={event.code}
        state={event.state}
        playerCount={roster.length}
        questionCount={qs.length}
      />

      {event.state !== "draft" ? (
        <PlayerLinksSection
          eventCode={event.code}
          players={roster}
          origin={await getOrigin()}
          state={event.state}
        />
      ) : null}
    </main>
  );
}

async function getOrigin(): Promise<string> {
  const envOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (envOrigin) return envOrigin.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function StateSection({
  eventCode,
  state,
  playerCount,
  questionCount,
}: {
  eventCode: string;
  state: string;
  playerCount: number;
  questionCount: number;
}) {
  return (
    <section className="mt-6 rounded border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium">Event state</h2>
        <span className="font-mono text-xs text-zinc-500">{state}</span>
      </div>
      {state === "draft" ? (
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <p className="text-zinc-600">
            Opening the survey mints player links and locks destructive question
            edits.
          </p>
          <form action={openSurvey.bind(null, eventCode)}>
            <button
              type="submit"
              disabled={playerCount === 0 || questionCount === 0}
              className="rounded bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-zinc-800"
            >
              Open Survey →
            </button>
            {playerCount === 0 || questionCount === 0 ? (
              <span className="ml-3 text-xs text-zinc-500">
                Need a roster and at least one question.
              </span>
            ) : null}
          </form>
        </div>
      ) : state === "survey_open" ? (
        <form action={closeSurvey.bind(null, eventCode)} className="mt-3">
          <button
            type="submit"
            className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800"
          >
            Close Survey →
          </button>
        </form>
      ) : state === "survey_closed" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={`/admin/${eventCode}/curate`}
            className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800"
          >
            Curate →
          </a>
          <form action={reopenSurvey.bind(null, eventCode)}>
            <button
              type="submit"
              className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
            >
              ← Reopen Survey
            </button>
          </form>
        </div>
      ) : state === "curation_locked" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={`/admin/${eventCode}/start`}
            className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800"
          >
            Start Game →
          </a>
          <a
            href={`/admin/${eventCode}/curate`}
            className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
          >
            View curation
          </a>
        </div>
      ) : state === "live" || state === "ended" ? (
        <div className="mt-3">
          <a
            href={`/facilitate/${eventCode}`}
            className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800"
          >
            {state === "live" ? "Live dashboard →" : "View final board →"}
          </a>
        </div>
      ) : null}
    </section>
  );
}

function PlayerLinksSection({
  eventCode,
  players,
  origin,
  state,
}: {
  eventCode: string;
  players: PlayerRow[];
  origin: string;
  state: string;
}) {
  const lines = players.map(
    (p) => `${p.display_name} — ${origin}/p/${eventCode}/${p.access_code}`,
  );
  const canRemint = state !== "ended";
  return (
    <section className="mt-6 rounded border border-zinc-200 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium">Player links</h2>
        <span className="text-xs text-zinc-500">DM each person</span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Paste the block into Slack. Each line is one person's private link.
      </p>
      <textarea
        readOnly
        rows={Math.min(10, Math.max(3, players.length))}
        value={lines.join("\n")}
        className="mt-3 w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-[11px]"
      />

      <ul className="mt-3 divide-y divide-zinc-200 rounded border border-zinc-200 bg-white text-sm">
        {players.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between px-3 py-2"
          >
            <span>
              {p.display_name}
              {p.survey_submitted_at ? (
                <span className="ml-2 text-xs text-green-600">✓ submitted</span>
              ) : (
                <span className="ml-2 text-xs text-zinc-400">⏳ pending</span>
              )}
            </span>
            {canRemint ? (
              <form
                action={remintAccessCode.bind(null, eventCode, p.id)}
                className="inline"
              >
                <button
                  type="submit"
                  className="text-xs text-zinc-500 underline hover:text-zinc-900"
                  title="Rotate access code — old link stops working"
                >
                  re-mint
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
