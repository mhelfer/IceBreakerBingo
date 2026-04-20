"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraOff, Check, Loader2 } from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";

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
  const [canRetry, setCanRetry] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
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
      } catch {
        if (!cancelled) {
          setError(
            "Couldn't start the camera. In Safari: tap AA → Website Settings → Camera → Allow, then reload.",
          );
          setCanRetry(false);
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
          setCanRetry(true);
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
        setCanRetry(true);
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
  }, [router, retryKey]);

  if (error) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white p-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
          <CameraOff size={20} />
        </span>
        <h2 className="text-sm font-semibold text-zinc-900">Camera blocked</h2>
        <p className="text-xs leading-relaxed text-zinc-600">{error}</p>
        <button
          type="button"
          onClick={() => {
            if (canRetry) {
              setError(null);
              setCanRetry(false);
              setStatus("booting");
              stoppedRef.current = false;
              setRetryKey((k) => k + 1);
            } else {
              window.location.reload();
            }
          }}
          className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-black shadow-sm">
        <style>{`#${SCANNER_ELEMENT_ID} video { object-fit: cover !important; width: 100% !important; height: 100% !important; }`}</style>
        <div id={SCANNER_ELEMENT_ID} className="h-full w-full" />
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <div className="relative h-[62%] w-[62%]">
            <span className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-white/90 rounded-tl" />
            <span className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-white/90 rounded-tr" />
            <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-white/90 rounded-bl" />
            <span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-white/90 rounded-br" />
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-zinc-500">
        {status === "booting" ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" /> Starting camera…
          </span>
        ) : status === "scanning" ? (
          "Point at your teammate's My QR screen."
        ) : (
          <span className="inline-flex items-center gap-1.5 text-emerald-600">
            <Check size={12} /> Decoded — loading…
          </span>
        )}
      </p>
    </div>
  );
}
