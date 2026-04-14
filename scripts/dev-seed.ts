// Dev seed: creates a facilitator + a draft event and prints a session cookie
// so you can curl /admin pages without clicking through the UI.
//
// Usage:
//   SUPABASE_URL=http://127.0.0.1:54321 \
//     SUPABASE_SERVICE_ROLE_KEY=<key> \
//     SESSION_COOKIE_SECRET=<32+chars> \
//     node --experimental-strip-types scripts/dev-seed.ts

import { createClient } from "@supabase/supabase-js";
import { hashPassword } from "../lib/password.ts";
import { encodeSession } from "../lib/session-token.ts";
import { generateEventCode } from "../lib/ids.ts";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const email = `dev+${Date.now()}@example.com`;
const password_hash = await hashPassword("devpassword");

const { data: fac, error: facErr } = await supabase
  .from("facilitators")
  .insert({ email, password_hash })
  .select("id")
  .single();
if (facErr || !fac) throw new Error(facErr?.message ?? "no facilitator");

const code = generateEventCode();
const { data: ev, error: evErr } = await supabase
  .from("events")
  .insert({
    facilitator_id: fac.id,
    code,
    name: "Dev Seed Event",
  })
  .select("code")
  .single();
if (evErr || !ev) throw new Error(evErr?.message ?? "no event");

const cookie = encodeSession({
  kind: "facilitator",
  facilitator_id: fac.id,
  iat: Math.floor(Date.now() / 1000),
});

console.log(JSON.stringify({ email, code: ev.code, cookie }, null, 2));
