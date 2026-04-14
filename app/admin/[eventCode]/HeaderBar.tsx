import Link from "next/link";
import { ArrowRight, ChevronLeft, Play } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readSession } from "@/lib/session";
import { StatePill, type EventState } from "@/app/components/ui/StatePill";
import { StatTile } from "@/app/components/ui/StatTile";
import { buttonClass } from "@/app/components/ui/Button";
import { closeSurvey, openSurvey, reopenSurvey } from "./actions";
import { unlockCuration } from "./curate/actions";

type EventRow = {
  id: string;
  code: string;
  name: string;
  state: EventState;
  starts_at: string | null;
};

export async function HeaderBar({ eventCode }: { eventCode: string }) {
  const session = await readSession();
  if (!session || session.kind !== "facilitator") return null;

  const supabase = getSupabaseAdmin();
  const { data: event } = await supabase
    .from("events")
    .select("id, code, name, state, starts_at")
    .eq("code", eventCode.toUpperCase())
    .eq("facilitator_id", session.facilitator_id)
    .maybeSingle<EventRow>();
  if (!event) return null;

  const [{ count: playerCount }, { count: submittedCount }, { count: questionCount }] =
    await Promise.all([
      supabase
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id),
      supabase
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .not("survey_submitted_at", "is", null),
      supabase
        .from("survey_questions")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id),
    ]);

  const players = playerCount ?? 0;
  const submitted = submittedCount ?? 0;
  const questions = questionCount ?? 0;

  return (
    <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto max-w-5xl px-4 pt-4 pb-3 sm:px-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900"
        >
          <ChevronLeft size={14} /> All events
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
                {event.name}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600">
                {event.code}
              </span>
              <StatePill state={event.state} />
            </div>
            {event.starts_at ? (
              <p className="mt-1 text-xs text-zinc-500">
                Starts{" "}
                <time dateTime={event.starts_at}>
                  {new Date(event.starts_at).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SecondaryActions state={event.state} code={event.code} />
            <PrimaryCta
              state={event.state}
              code={event.code}
              playerCount={players}
              questionCount={questions}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Players" value={players} />
          <StatTile
            label="Submitted"
            value={`${submitted} / ${players}`}
            tone={
              players > 0 && submitted === players
                ? "success"
                : players > 0 && submitted === 0
                  ? "warning"
                  : "default"
            }
          />
          <StatTile label="Questions" value={questions} />
          <StatTile
            label="State"
            value={<span className="text-sm">{labelFor(event.state)}</span>}
          />
        </div>
      </div>
    </div>
  );
}

function labelFor(s: EventState): string {
  return (
    {
      draft: "Draft",
      survey_open: "Collecting",
      survey_closed: "Ready to curate",
      curation_locked: "Ready to start",
      live: "In progress",
      ended: "Wrapped",
    } as const
  )[s];
}

function PrimaryCta({
  state,
  code,
  playerCount,
  questionCount,
}: {
  state: EventState;
  code: string;
  playerCount: number;
  questionCount: number;
}) {
  const cls = buttonClass("primary", "md");
  if (state === "draft") {
    const disabled = playerCount === 0 || questionCount === 0;
    return (
      <form action={openSurvey.bind(null, code)}>
        <button
          type="submit"
          disabled={disabled}
          title={
            disabled
              ? "Need a roster and at least one question."
              : "Mint player links and open the survey"
          }
          className={cls}
        >
          Open Survey <ArrowRight size={14} />
        </button>
      </form>
    );
  }
  if (state === "survey_open") {
    return (
      <form action={closeSurvey.bind(null, code)}>
        <button type="submit" className={cls}>
          Close Survey <ArrowRight size={14} />
        </button>
      </form>
    );
  }
  if (state === "survey_closed") {
    return (
      <Link href={`/admin/${code}/curate`} className={cls}>
        Curate <ArrowRight size={14} />
      </Link>
    );
  }
  if (state === "curation_locked") {
    return (
      <Link href={`/admin/${code}/start`} className={cls}>
        Start Game <Play size={14} />
      </Link>
    );
  }
  if (state === "live") {
    return (
      <Link href={`/facilitate/${code}`} className={cls}>
        Live dashboard <ArrowRight size={14} />
      </Link>
    );
  }
  return (
    <Link href={`/facilitate/${code}`} className={cls}>
      View results <ArrowRight size={14} />
    </Link>
  );
}

function SecondaryActions({
  state,
  code,
}: {
  state: EventState;
  code: string;
}) {
  if (state === "survey_closed") {
    return (
      <form action={reopenSurvey.bind(null, code)}>
        <button type="submit" className={buttonClass("ghost", "md")}>
          <ChevronLeft size={14} /> Reopen survey
        </button>
      </form>
    );
  }
  if (state === "curation_locked") {
    return (
      <form action={unlockCuration.bind(null, code)}>
        <button type="submit" className={buttonClass("ghost", "md")}>
          <ChevronLeft size={14} /> Unlock curation
        </button>
      </form>
    );
  }
  return null;
}
