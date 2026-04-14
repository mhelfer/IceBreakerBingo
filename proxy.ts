import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  encodeSession,
} from "@/lib/session-token";

// Resolves /p/:eventCode/:accessCode to a session cookie without redirecting
// the player off the entry URL. Lets them bookmark the link and reload as the
// event state changes (draft → survey_open → live → ended).
//
// Next 16's Proxy runs in the Node runtime by default, so node:crypto and
// supabase-js both work here.
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const segs = request.nextUrl.pathname.split("/").filter(Boolean);
  // Matcher guarantees /p/<eventCode>/<accessCode> — 3 segments.
  if (segs.length !== 3 || segs[0] !== "p") return NextResponse.next();

  const eventCode = segs[1].toUpperCase();
  const accessCode = segs[2];

  const supabase = getSupabaseAdmin();
  const { data: event } = await supabase
    .from("events")
    .select("id")
    .eq("code", eventCode)
    .maybeSingle();
  if (!event) {
    return NextResponse.rewrite(new URL("/p/link-invalid", request.url));
  }
  const { data: player } = await supabase
    .from("players")
    .select("id, event_id")
    .eq("event_id", event.id)
    .eq("access_code", accessCode)
    .maybeSingle();
  if (!player) {
    return NextResponse.rewrite(new URL("/p/link-invalid", request.url));
  }

  const cookie = encodeSession({
    kind: "player",
    player_id: player.id,
    event_id: player.event_id,
    iat: Math.floor(Date.now() / 1000),
  });
  const res = NextResponse.next();
  res.cookies.set(SESSION_COOKIE_NAME, cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

export const config = {
  matcher: "/p/:eventCode/:accessCode",
};
