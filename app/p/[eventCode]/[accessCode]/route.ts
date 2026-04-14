import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  encodeSession,
} from "@/lib/session-token";

// Player entry point. Looks up the player by (event.code, access_code),
// sets the session cookie, and redirects based on event state.
// Unknown/rotated codes 404 without leaking whether the event exists.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventCode: string; accessCode: string }> },
): Promise<NextResponse> {
  const { eventCode, accessCode } = await params;
  const codeUpper = eventCode.toUpperCase();
  const supabase = getSupabaseAdmin();

  const { data: event, error: eErr } = await supabase
    .from("events")
    .select("id, code, state")
    .eq("code", codeUpper)
    .maybeSingle();
  if (eErr) throw new Error(eErr.message);
  if (!event) {
    return NextResponse.redirect(new URL("/p/link-invalid", request.url));
  }

  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id, event_id, absent, survey_submitted_at")
    .eq("event_id", event.id)
    .eq("access_code", accessCode)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!player) {
    return NextResponse.redirect(new URL("/p/link-invalid", request.url));
  }

  const destination = destinationForState(event.state, player.survey_submitted_at);
  const res = NextResponse.redirect(new URL(destination, request.url));

  const cookie = encodeSession({
    kind: "player",
    player_id: player.id,
    event_id: event.id,
    iat: Math.floor(Date.now() / 1000),
  });
  res.cookies.set(SESSION_COOKIE_NAME, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

function destinationForState(
  state: string,
  submittedAt: string | null,
): string {
  if (state === "draft") return "/p/not-yet";
  if (state === "survey_open") {
    return submittedAt ? "/p/survey-done" : "/p/survey";
  }
  if (state === "survey_closed" || state === "curation_locked") {
    return "/p/not-yet";
  }
  if (state === "live") return "/p/card";
  if (state === "ended") return "/p/card";
  return "/p/not-yet";
}
