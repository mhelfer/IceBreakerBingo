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
    width: 320,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });

  return (
    <main className="mx-auto max-w-md px-4 pb-20 pt-6">
      <header className="mb-4 flex items-baseline justify-between">
        <p className="text-xs text-zinc-500">{event.name}</p>
        <p className="font-mono text-xs text-zinc-500">{event.code}</p>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-4">
        <div
          className="mx-auto aspect-square w-full max-w-[320px]"
          dangerouslySetInnerHTML={{ __html: svg }}
          aria-label={`QR code for ${player.display_name}`}
        />
        <p className="mt-4 text-center text-lg font-semibold">
          {player.display_name}
        </p>
        <p className="mt-2 text-center text-xs text-zinc-500">
          Let teammates scan this to claim a square on their card.
        </p>
      </section>

      <PlayerTabs active="qr" />
    </main>
  );
}
