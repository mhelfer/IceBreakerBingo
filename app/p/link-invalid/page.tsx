export default function LinkInvalidPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold">This link is out of date.</h1>
      <p className="mt-3 text-sm text-zinc-600">
        Ask your facilitator for a fresh one. Personal links can be rotated if
        they leak.
      </p>
    </main>
  );
}
