import { notFound, redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readSession } from "@/lib/session";
import {
  bucketCounts,
  discoveryAnswerCount,
  MIN_MATCHERS,
  nonEmptyTextAnswers,
  type ResponseValue,
} from "@/lib/curation";
import type { MatchRule } from "@/lib/traits";
import {
  lockCuration,
  setTraitEnabled,
  unlockCuration,
  updateTraitPrompt,
  updateTraitSquareText,
} from "./actions";

export const dynamic = "force-dynamic";

type QuestionRow = {
  id: string;
  prompt: string;
  type: "single" | "multi" | "binary" | "text" | "numeric_bucket";
  options: string[] | null;
  position: number;
};

type TraitRow = {
  id: string;
  question_id: string;
  kind: "cohort" | "discovery";
  match_rule: MatchRule | null;
  square_text: string;
  conversation_prompt: string | null;
  enabled: boolean;
};

type ResponseRow = { question_id: string; value: ResponseValue };

export default async function CuratePage({
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
    .select("id, code, name, state")
    .eq("code", codeUpper)
    .eq("facilitator_id", session.facilitator_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!event) notFound();

  const editable = event.state === "survey_closed";
  const locked = event.state === "curation_locked";
  // Allow viewing in survey_closed, curation_locked; otherwise redirect.
  if (!editable && !locked) {
    redirect(`/admin/${event.code}`);
  }

  const [{ data: qs }, { data: traits }, { data: responses }, { count: rosterCount }] =
    await Promise.all([
      supabase
        .from("survey_questions")
        .select("id, prompt, type, options, position")
        .eq("event_id", event.id)
        .order("position"),
      supabase
        .from("trait_templates")
        .select(
          "id, question_id, kind, match_rule, square_text, conversation_prompt, enabled",
        )
        .eq("event_id", event.id),
      supabase
        .from("survey_responses")
        .select("question_id, value, player_id, players!inner(event_id)")
        .eq("players.event_id", event.id),
      supabase
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id),
    ]);

  const questions = (qs ?? []) as QuestionRow[];
  const allTraits = (traits ?? []) as TraitRow[];
  const allResponses = (responses ?? []) as ResponseRow[];

  const traitsByQuestion = new Map<string, TraitRow[]>();
  for (const t of allTraits) {
    const arr = traitsByQuestion.get(t.question_id) ?? [];
    arr.push(t);
    traitsByQuestion.set(t.question_id, arr);
  }
  const responsesByQuestion = new Map<string, ResponseValue[]>();
  for (const r of allResponses) {
    const arr = responsesByQuestion.get(r.question_id) ?? [];
    arr.push(r.value);
    responsesByQuestion.set(r.question_id, arr);
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <nav className="text-sm">
        <a
          href={`/admin/${event.code}`}
          className="text-zinc-500 hover:text-zinc-900"
        >
          ← Back to event
        </a>
      </nav>

      <header className="mt-4 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">{event.name} — Curate</h1>
        <div className="font-mono text-sm text-zinc-500">
          {event.code} · {event.state}
        </div>
      </header>

      <p className="mt-4 text-sm text-zinc-600">
        Review aggregated answers, tune trait wording, disable buckets that
        won't complete. Buckets with fewer than {MIN_MATCHERS} matchers are
        flagged uncompletable.
      </p>
      {!editable ? (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Curation is locked. Unlock to edit trait templates.
        </div>
      ) : null}

      {rosterCount != null ? (
        <p className="mt-2 text-xs text-zinc-500">
          Roster size: {rosterCount}
        </p>
      ) : null}

      <ol className="mt-6 flex flex-col gap-6">
        {questions.map((q) => {
          const qTraits = (traitsByQuestion.get(q.id) ?? []).slice().sort(
            (a, b) => a.kind.localeCompare(b.kind),
          );
          const qResponses = responsesByQuestion.get(q.id) ?? [];
          return (
            <li
              key={q.id}
              className="rounded border border-zinc-200 bg-white p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium">
                  <span className="font-mono text-xs text-zinc-400">
                    {q.position + 1}.
                  </span>{" "}
                  {q.prompt}
                </p>
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
                  {q.type}
                </span>
              </div>

              {q.type === "text" ? (
                <DiscoveryQuestion
                  eventCode={event.code}
                  traits={qTraits.filter((t) => t.kind === "discovery")}
                  responses={qResponses}
                  editable={editable}
                />
              ) : (
                <CohortQuestion
                  eventCode={event.code}
                  type={q.type}
                  traits={qTraits.filter((t) => t.kind === "cohort")}
                  responses={qResponses}
                  editable={editable}
                />
              )}
            </li>
          );
        })}
      </ol>

      <section className="mt-8 rounded border border-zinc-200 bg-zinc-50 p-4">
        <h2 className="text-lg font-medium">Curation state</h2>
        {editable ? (
          <>
            <p className="mt-2 text-sm text-zinc-600">
              Locking curation freezes trait templates. Cards are generated when
              you start the game.
            </p>
            <form
              action={lockCuration.bind(null, event.code)}
              className="mt-3"
            >
              <button
                type="submit"
                className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-zinc-800"
              >
                Lock Curation →
              </button>
            </form>
          </>
        ) : (
          <form
            action={unlockCuration.bind(null, event.code)}
            className="mt-3"
          >
            <button
              type="submit"
              className="rounded border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
            >
              ← Unlock curation
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function CohortQuestion({
  eventCode,
  type,
  traits,
  responses,
  editable,
}: {
  eventCode: string;
  type: "single" | "multi" | "binary" | "numeric_bucket";
  traits: TraitRow[];
  responses: ResponseValue[];
  editable: boolean;
}) {
  const counts = bucketCounts(type, responses);
  return (
    <div className="mt-3 overflow-hidden rounded border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-600">
          <tr>
            <th className="px-3 py-2 text-left">Bucket</th>
            <th className="w-16 px-3 py-2 text-right">Count</th>
            <th className="px-3 py-2 text-left">Square text (≤36)</th>
            <th className="px-3 py-2 text-left">Conversation prompt</th>
            <th className="w-24 px-3 py-2 text-center">State</th>
          </tr>
        </thead>
        <tbody>
          {traits.map((t) => {
            const bucket = t.match_rule?.value ?? "—";
            const n = typeof bucket === "string" ? counts[bucket] ?? 0 : 0;
            const low = n < MIN_MATCHERS;
            return (
              <tr key={t.id} className="border-t border-zinc-200 align-top">
                <td className="px-3 py-2">{bucket}</td>
                <td
                  className={`px-3 py-2 text-right font-mono text-xs ${
                    low ? "text-amber-700" : "text-zinc-600"
                  }`}
                >
                  {n}
                  {low ? " ⚠" : ""}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <form
                      action={updateTraitSquareText.bind(
                        null,
                        eventCode,
                        t.id,
                      )}
                      className="flex gap-1"
                    >
                      <input
                        name="square_text"
                        defaultValue={t.square_text}
                        maxLength={36}
                        className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs"
                      />
                      <button
                        type="submit"
                        className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                      >
                        ✓
                      </button>
                    </form>
                  ) : (
                    <span className="font-mono text-xs">{t.square_text}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {editable ? (
                    <form
                      action={updateTraitPrompt.bind(null, eventCode, t.id)}
                      className="flex gap-1"
                    >
                      <input
                        name="conversation_prompt"
                        defaultValue={t.conversation_prompt ?? ""}
                        className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs"
                      />
                      <button
                        type="submit"
                        className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                      >
                        ✓
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-zinc-600">
                      {t.conversation_prompt ?? "—"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {editable ? (
                    <form
                      action={setTraitEnabled.bind(
                        null,
                        eventCode,
                        t.id,
                        !t.enabled,
                      )}
                    >
                      <button
                        type="submit"
                        className={`rounded px-2 py-1 text-xs ${
                          t.enabled
                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                            : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"
                        }`}
                      >
                        {t.enabled ? "enabled" : "disabled"}
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-zinc-500">
                      {t.enabled ? "enabled" : "disabled"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          {traits.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-3 py-4 text-center text-xs text-zinc-500"
              >
                No trait templates for this question.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function DiscoveryQuestion({
  eventCode,
  traits,
  responses,
  editable,
}: {
  eventCode: string;
  traits: TraitRow[];
  responses: ResponseValue[];
  editable: boolean;
}) {
  const n = discoveryAnswerCount(responses);
  const low = n < MIN_MATCHERS;
  const answers = nonEmptyTextAnswers(responses);
  // Shuffle answers so position in the list doesn't align with player order.
  const shuffled = shuffleCopy(answers);

  return (
    <div className="mt-3">
      <div className="flex items-baseline gap-3 text-xs">
        <span className={low ? "text-amber-700" : "text-zinc-600"}>
          {n} answer{n === 1 ? "" : "s"}
          {low ? " ⚠ below minimum" : ""}
        </span>
        <span className="text-zinc-500">
          (any teammate who answered satisfies the discovery square)
        </span>
      </div>

      {traits.map((t) => (
        <div
          key={t.id}
          className="mt-3 flex flex-col gap-2 rounded border border-zinc-200 bg-zinc-50 p-3"
        >
          <label className="flex items-center gap-2 text-xs">
            <span className="w-20 text-zinc-500">Square text:</span>
            {editable ? (
              <form
                action={updateTraitSquareText.bind(null, eventCode, t.id)}
                className="flex flex-1 gap-1"
              >
                <input
                  name="square_text"
                  defaultValue={t.square_text}
                  maxLength={36}
                  className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs"
                />
                <button
                  type="submit"
                  className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                >
                  ✓
                </button>
              </form>
            ) : (
              <span className="font-mono">{t.square_text}</span>
            )}
          </label>
          {editable ? (
            <form
              action={setTraitEnabled.bind(null, eventCode, t.id, !t.enabled)}
            >
              <button
                type="submit"
                className={`rounded px-2 py-1 text-xs ${
                  t.enabled
                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                    : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"
                }`}
              >
                {t.enabled ? "enabled" : "disabled"}
              </button>
            </form>
          ) : (
            <span className="text-xs text-zinc-500">
              {t.enabled ? "enabled" : "disabled"}
            </span>
          )}
        </div>
      ))}

      {shuffled.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-zinc-600">
            Anonymized answers ({shuffled.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-xs text-zinc-700">
            {shuffled.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function shuffleCopy<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
