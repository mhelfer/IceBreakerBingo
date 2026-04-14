import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { readSession } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { encodeQrPayload } from "@/lib/qr";
import { PlayerTabs } from "../PlayerTabs";

export const dynamic = "force-dynamic";

export default async function PlayerQrPage() {
  const session = await readSession();
  if (!session || session.kind !== "player") redirect("/p/link-invalid");

  const supabase = getSupabaseAdmin();
  const { data: player } = await supabase
    .from("players")
    .select("id, display_name, qr_nonce, event_id, events(code, name, state)")
    .eq("id", session.player_id)
    .maybeSingle();
  if (!player) redirect("/p/link-invalid");

  const event = Array.isArray(player.events) ? player.events[0] : player.events;
  if (!event) redirect("/p/link-invalid");
  if (event.state !== "live" && event.state !== "ended") {
    redirect("/p/not-yet");
  }

  const payload = encodeQrPayload({
    eventCode: event.code,
    playerId: player.id,
    qrNonce: player.qr_nonce,
  });
  const svg = await QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 360,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 pb-28 pt-8">
      <div className="w-full text-center">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          {event.name}
        </p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-900">
          {player.display_name}
        </h1>

        <div
          className="mx-auto mt-6 aspect-square w-full max-w-[360px] overflow-hidden rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm"
          dangerouslySetInnerHTML={{ __html: svg }}
          aria-label={`QR code for ${player.display_name}`}
        />

        <p className="mx-auto mt-6 max-w-[260px] text-sm text-zinc-500">
          Let teammates scan this to claim a square on their card.
        </p>
      </div>

      <PlayerTabs active="qr" />
    </main>
  );
}
