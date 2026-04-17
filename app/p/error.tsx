"use client";

export default function PlayerError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 pb-24 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-xs text-sm text-zinc-600">
        Tap below to reload. If it keeps happening, check your connection or ask
        the facilitator for help.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex h-12 w-full max-w-xs items-center justify-center rounded-md bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Tap to reload
      </button>
    </div>
  );
}
