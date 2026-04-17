"use client";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-xs text-sm text-zinc-600">
        An unexpected error occurred. Try again — if it keeps happening, let the
        facilitator know.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Try again
      </button>
    </div>
  );
}
