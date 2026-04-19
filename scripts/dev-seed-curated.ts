// Dev seed: builds a realistic event ready for manual curation / Start Game.
//
// Produces:
//   - 1 facilitator (email + password: devpassword)
//   - 1 event in state `survey_closed` with auto-generated trait templates
//     matching the built-in STARTER_QUESTIONS set (same prompts/options as
//     "Load starter template" in the admin UI)
//   - 32 players (round-robin distribution). 32 is the smallest multiple of
//     8 (the widest cohort option list in STARTER_QUESTIONS — first
//     programming language) ≥ 24, so every enabled cohort bucket sits at
//     ≥ 4 matchers and tolerates a 1-absentee drop at Start Game without
//     falling below the MIN_MATCHERS = 3 floor.
//
// Usage:
//   SUPABASE_URL=http://127.0.0.1:54321 \
//     SUPABASE_SERVICE_ROLE_KEY=<key> \
//     SESSION_COOKIE_SECRET=<32+chars> \
//     node --experimental-strip-types scripts/dev-seed-curated.ts

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/db-types.ts";
import { hashPassword } from "../lib/password.ts";
import { encodeSession } from "../lib/session-token.ts";
import { generateEventCode, generate96BitToken } from "../lib/ids.ts";
import {
  STARTER_QUESTIONS,
  TEXT_ANSWER_POOLS,
  GENERIC_TEXT_POOL,
} from "../lib/questionTemplate.ts";
import type { MatchRule } from "../lib/traits.ts";

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const PLAYER_COUNT = 32;

// Round-robin picker for single/binary/numeric cohort answers. Offsetting by
// qi keeps distribution uncorrelated across questions (no player ends up in
// the "A" bucket for everything).
function pickOption(pi: number, qi: number, options: string[]): string {
  return options[(pi + qi * 3) % options.length];
}

// Deterministic multi-pick: each player picks exactly 2 options. This keeps
// every option well above MIN_MATCHERS for reasonable option counts (n ≤ 8).
function pickMulti(pi: number, qi: number, options: string[]): string[] {
  const n = options.length;
  const a = (pi + qi * 3) % n;
  const b = (pi + qi * 3 + Math.max(1, Math.floor(n / 2))) % n;
  return a === b ? [options[a]] : [options[a], options[b]];
}

function pickText(pi: number, prompt: string): string {
  const pool = TEXT_ANSWER_POOLS[prompt] ?? GENERIC_TEXT_POOL;
  return pool[pi % pool.length];
}

const email = `dev+${Date.now()}@example.com`;
const password = "devpassword";
const { data: fac, error: facErr } = await supabase
  .from("facilitators")
  .insert({ email, password_hash: await hashPassword(password) })
  .select("id")
  .single();
if (facErr || !fac) throw new Error(facErr?.message ?? "no facilitator");

const code = generateEventCode();
const { data: ev, error: evErr } = await supabase
  .from("events")
  .insert({
    facilitator_id: fac.id,
    code,
    name: "Dev Curated Event",
    state: "survey_closed",
    survey_opened_at: new Date().toISOString(),
    survey_closed_at: new Date().toISOString(),
  })
  .select("id, code")
  .single();
if (evErr || !ev) throw new Error(evErr?.message ?? "no event");

function playerLabel(i: number): string {
  // A..Z, then AA, AB, ... so we don't roll off into punctuation past Z.
  if (i < 26) return String.fromCharCode(65 + i);
  const hi = Math.floor(i / 26) - 1;
  const lo = i % 26;
  return `${String.fromCharCode(65 + hi)}${String.fromCharCode(65 + lo)}`;
}
const playerRows = Array.from({ length: PLAYER_COUNT }, (_, i) => ({
  event_id: ev.id,
  display_name: `Player ${playerLabel(i)}`,
  access_code: generate96BitToken(),
  qr_nonce: generate96BitToken(),
  survey_submitted_at: new Date().toISOString(),
}));
const { data: players, error: pErr } = await supabase
  .from("players")
  .insert(playerRows)
  .select("id, display_name, access_code");
if (pErr || !players) throw new Error(pErr?.message ?? "no players");

// Insert questions from the built-in starter set.
const questionRows = STARTER_QUESTIONS.map((q, i) => ({
  event_id: ev.id,
  prompt: q.prompt,
  type: q.type,
  options: q.options ?? null,
  position: i,
}));
const { data: insertedQs, error: qErr } = await supabase
  .from("survey_questions")
  .insert(questionRows)
  .select("id, position")
  .order("position");
if (qErr || !insertedQs) throw new Error(qErr?.message ?? "no questions");

// Build trait templates using the starter template's per-option square data.
const traitRows: {
  event_id: string;
  question_id: string;
  kind: "cohort" | "discovery";
  match_rule: MatchRule | null;
  square_text: string;
  conversation_prompt: string | null;
  enabled: boolean;
}[] = [];
for (const row of insertedQs) {
  const starter = STARTER_QUESTIONS[row.position];
  if (!starter) continue;
  if (starter.type === "text") {
    const sq = starter.squares[0];
    traitRows.push({
      event_id: ev.id,
      question_id: row.id,
      kind: "discovery",
      match_rule: null,
      square_text: (sq?.squareText ?? `Learn: ${starter.prompt}`).slice(0, 36),
      conversation_prompt: null,
      enabled: sq?.enabled ?? true,
    });
  } else {
    const op: MatchRule["op"] = starter.type === "multi" ? "includes" : "eq";
    for (const sq of starter.squares) {
      traitRows.push({
        event_id: ev.id,
        question_id: row.id,
        kind: "cohort",
        match_rule: { op, value: sq.answer },
        square_text: sq.squareText.slice(0, 36),
        conversation_prompt: sq.prompt || null,
        enabled: sq.enabled,
      });
    }
  }
}
const { error: trErr } = await supabase
  .from("trait_templates")
  .insert(traitRows);
if (trErr) throw new Error(trErr.message);

// Generate responses per player × question.
const responses: Database["public"]["Tables"]["survey_responses"]["Insert"][] =
  [];
for (let pi = 0; pi < players.length; pi++) {
  for (let qi = 0; qi < insertedQs.length; qi++) {
    const starter = STARTER_QUESTIONS[insertedQs[qi].position];
    if (!starter) continue;
    const opts = starter.options ?? [];
    let value: string | string[];
    if (starter.type === "text") {
      value = pickText(pi, starter.prompt);
    } else if (starter.type === "multi") {
      value = pickMulti(pi, qi, opts);
    } else {
      value = pickOption(pi, qi, opts);
    }
    responses.push({
      player_id: players[pi].id,
      question_id: insertedQs[qi].id,
      value,
    });
  }
}
const { error: rErr } = await supabase
  .from("survey_responses")
  .insert(responses);
if (rErr) throw new Error(rErr.message);

const cookie = encodeSession({
  kind: "facilitator",
  facilitator_id: fac.id,
  iat: Math.floor(Date.now() / 1000),
});

console.log(
  JSON.stringify(
    {
      facilitator: { email, password },
      event: { code: ev.code, id: ev.id, state: "survey_closed" },
      facilitator_cookie: cookie,
      urls: {
        login: "http://localhost:3000/admin/login",
        dashboard: `http://localhost:3000/admin/${ev.code}`,
        curate: `http://localhost:3000/admin/${ev.code}/curate`,
      },
      players: players.map((p) => ({
        name: p.display_name,
        link: `http://localhost:3000/p/${ev.code}/${p.access_code}`,
      })),
    },
    null,
    2,
  ),
);
