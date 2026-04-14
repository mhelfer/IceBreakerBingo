"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Html5Qrcode } from "html5-qrcode";

// Shape we stash in sessionStorage for /p/card's picker mode to pick up.
type PickerPayload = {
  scanned: { id: string; displayName: string };
  result: "eligible" | "already_used" | "none";
  eligibleTiles: {
    position: number;
    squareText: string;
    kind: "cohort" | "discovery";
  }[];
  postedAt: number;
};

const SCANNER_ELEMENT_ID = "ibb-scanner";

export function Scanner() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"booting" | "scanning" | "decoded">(
    "booting",
  );
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });
        scannerRef.current = scanner;
        setStatus("scanning");

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decodedText) => {
            if (stoppedRef.current) return;
            stoppedRef.current = true;
            setStatus("decoded");
            navigator.vibrate?.(20);
            try {
              await scanner.stop();
            } catch {
              // ignore stop errors
            }
            await handleDecoded(decodedText);
          },
          () => {
            // ignore per-frame decode failures
          },
        );
      } catch (e) {
        if (!cancelled) {
          setError(
            "Couldn't start the camera. In Safari: tap AA → Website Settings → Camera → Allow, then reload.",
          );
        }
      }
    })();

    async function handleDecoded(qrText: string) {
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ qrText }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Scan failed.");
          return;
        }
        const payload: PickerPayload = {
          scanned: data.scanned,
          result: data.result,
          eligibleTiles: data.eligibleTiles,
          postedAt: Date.now(),
        };
        sessionStorage.setItem("ibb:picker", JSON.stringify(payload));
        router.push("/p/card");
      } catch {
        setError("Network hiccup — try scanning again.");
      }
    }

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s && !stoppedRef.current) {
        stoppedRef.current = true;
        s.stop().catch(() => {});
      }
    };
  }, [router]);

  return (
    <div className="space-y-3">
      <div
        id={SCANNER_ELEMENT_ID}
        className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded bg-black"
      />
      {status === "booting" ? (
        <p className="text-center text-xs text-zinc-500">Starting camera…</p>
      ) : status === "scanning" ? (
        <p className="text-center text-xs text-zinc-500">
          Point at your teammate&apos;s My QR screen.
        </p>
      ) : (
        <p className="text-center text-xs text-zinc-500">Decoded — loading…</p>
      )}
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {error}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ml-2 underline"
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}
