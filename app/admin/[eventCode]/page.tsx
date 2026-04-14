import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readSession } from "@/lib/session";
import { Tabs, type TabDef } from "@/app/components/ui/Tabs";
import type { EventState } from "@/app/components/ui/StatePill";
import { QuestionsSection } from "./QuestionsSection";
import { RosterSection, type PlayerRow } from "./RosterSection";

export const dynamic = "force-dynamic";

type QuestionRow = {
  id: string;
  prompt: string;
  type: "single" | "multi" | "binary" | "text" | "numeric_bucket";
  options: string[] | null;
  position: number;
};

type TabKey = "questions" | "roster";

export default async function EventDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventCode: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await readSession();
  if (!session || session.kind !== "facilitator") redirect("/admin/login");

  const { eventCode } = await params;
  const { tab: tabParam } = await searchParams;
  const codeUpper = eventCode.toUpperCase();
  const supabase = getSupabaseAdmin();

  const { data: event, error } = await supabase
    .from("events")
    .select("id, code, name, state")
    .eq("code", codeUpper)
    .eq("facilitator_id", session.facilitator_id)
    .maybeSingle<{ id: string; code: string; name: string; state: EventState }>();

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

  const active = normalizeTab(tabParam);

  const tabs: TabDef[] = [
    { key: "questions", label: "Questions", count: qs.length },
    { key: "roster", label: "Roster", count: roster.length },
  ];

  const origin = await getOrigin();
  const baseHref = `/admin/${event.code}`;

  return (
    <div className="flex flex-col gap-5">
      <Tabs tabs={tabs} active={active} baseHref={baseHref} />

      <div>
        {active === "questions" ? (
          <QuestionsSection
            eventCode={event.code}
            state={event.state}
            questions={qs}
          />
        ) : (
          <RosterSection
            eventCode={event.code}
            state={event.state}
            players={roster}
            origin={origin}
          />
        )}
      </div>
    </div>
  );
}

function normalizeTab(raw: string | undefined): TabKey {
  if (raw === "roster") return "roster";
  return "questions";
}

async function getOrigin(): Promise<string> {
  const envOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (envOrigin) return envOrigin.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
