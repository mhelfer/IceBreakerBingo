import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { signIn, signUp } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  const session = await readSession();
  if (session?.kind === "facilitator") redirect("/admin");

  const { mode, error } = await searchParams;
  const isSignUp = mode === "signup";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold">
        IceBreakerBingo · Facilitator
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        {isSignUp ? "Create a facilitator account." : "Sign in to manage your events."}
      </p>

      {error ? (
        <p className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <form action={isSignUp ? signUp : signIn} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span>Email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            minLength={8}
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded bg-black px-4 py-2 text-white hover:bg-zinc-800"
        >
          {isSignUp ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-500">
        {isSignUp ? (
          <>
            Already have an account?{" "}
            <a href="/admin/login" className="underline">
              Sign in
            </a>
          </>
        ) : (
          <>
            New here?{" "}
            <a href="/admin/login?mode=signup" className="underline">
              Create an account
            </a>
          </>
        )}
      </p>
    </main>
  );
}
