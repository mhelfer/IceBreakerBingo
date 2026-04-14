// Dev seed: builds a realistic event ready for manual curation / Start Game.
//
// Produces:
//   - 1 facilitator (email + password: devpassword)
//   - 1 event in state `survey_closed` with auto-generated trait templates
//   - 24 players (6-per-bucket distribution) so dev testing tolerates 1-2
//     absentees at the Start Game attendance gate without breaking the
//     ≥ 3-matchers rule
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

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const PLAYER_COUNT = 24;
const OPTIONS = ["A", "B", "C", "D"] as const;
const QUESTION_COUNT = 8;

function pickOne(pi: number, qi: number): string {
  const bucket = (pi + qi) % PLAYER_COUNT;
  if (bucket < 6) return "A";
  if (bucket < 12) return "B";
  if (bucket < 18) return "C";
  return "D";
}

const TALENTS = [
  "balloon animals",
  "competitive chess",
  "unicycle",
  "fire breathing",
  "juggling",
  "perfect pitch",
  "speed cubing",
  "origami",
  "sourdough baking",
  "yo-yo tricks",
  "whistling songs",
  "break dancing",
  "card magic",
  "mountain climbing",
  "sword swallowing",
  "crochet",
  "tap dancing",
  "beekeeping",
  "archery",
  "calligraphy",
  "bird calls",
  "tarot reading",
  "knot tying",
  "stand-up comedy",
];

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

// Players (all with survey_submitted_at set).
const playerRows = Array.from({ length: PLAYER_COUNT }, (_, i) => ({
  event_id: ev.id,
  display_name: `Player ${String.fromCharCode(65 + i)}`,
  access_code: generate96BitToken(),
  qr_nonce: generate96BitToken(),
  survey_submitted_at: new Date().toISOString(),
}));
const { data: players, error: pErr } = await supabase
  .from("players")
  .insert(playerRows)
  .select("id, display_name, access_code");
if (pErr || !players) throw new Error(pErr?.message ?? "no players");

// Questions: 8 single-select cohort + 1 free-text discovery.
const cohortQuestionRows = Array.from({ length: QUESTION_COUNT }, (_, i) => ({
  event_id: ev.id,
  prompt: [
    "First programming language?",
    "Tabs vs spaces?",
    "Favorite pizza topping?",
    "Mountains or ocean?",
    "Early bird or night owl?",
    "Coffee or tea?",
    "Cats or dogs?",
    "Books or podcasts?",
  ][i],
  type: "single" as const,
  options: [...OPTIONS],
  position: i,
}));
const { data: cohortQs, error: cqErr } = await supabase
  .from("survey_questions")
  .insert(cohortQuestionRows)
  .select("id, position")
  .order("position");
if (cqErr || !cohortQs) throw new Error(cqErr?.message ?? "no cohort qs");

const { data: talentQ, error: tqErr } = await supabase
  .from("survey_questions")
  .insert({
    event_id: ev.id,
    prompt: "What's your hidden talent?",
    type: "text",
    options: null,
    position: QUESTION_COUNT,
  })
  .select("id")
  .single();
if (tqErr || !talentQ) throw new Error(tqErr?.message ?? "no talent q");

// Trait templates (cohort per option + one discovery).
const traitRows = [
  ...cohortQs.flatMap((q, qi) =>
    OPTIONS.map((opt) => ({
      event_id: ev.id,
      question_id: q.id,
      kind: "cohort" as const,
      match_rule: { op: "eq" as const, value: opt },
      square_text: `Q${qi + 1}: picked ${opt}`.slice(0, 36),
      conversation_prompt: `Ask them why ${opt}.`,
      enabled: true,
    })),
  ),
  {
    event_id: ev.id,
    question_id: talentQ.id,
    kind: "discovery" as const,
    match_rule: null,
    square_text: "Learn a hidden talent",
    conversation_prompt: null,
    enabled: true,
  },
];
const { error: trErr } = await supabase
  .from("trait_templates")
  .insert(traitRows);
if (trErr) throw new Error(trErr.message);

// Responses.
const responses: Database["public"]["Tables"]["survey_responses"]["Insert"][] =
  [];
for (let pi = 0; pi < players.length; pi++) {
  for (let qi = 0; qi < cohortQs.length; qi++) {
    responses.push({
      player_id: players[pi].id,
      question_id: cohortQs[qi].id,
      value: pickOne(pi, qi),
    });
  }
  responses.push({
    player_id: players[pi].id,
    question_id: talentQ.id,
    value: TALENTS[pi],
  });
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
