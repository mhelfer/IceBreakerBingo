import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { readSession } from "@/lib/session";
import { Button } from "@/app/components/ui/Button";
import { Card, CardBody } from "@/app/components/ui/Card";
import { Input, Label } from "@/app/components/ui/Input";
import { signIn, signUp } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in · IceBreaker Bingo",
};

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
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50/60 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            IceBreaker Bingo
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            {isSignUp
              ? "Create a facilitator account."
              : "Sign in to manage your events."}
          </p>
        </div>

        <Card>
          <CardBody className="flex flex-col gap-4 p-5">
            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <form
              action={isSignUp ? signUp : signIn}
              className="flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  required
                  minLength={8}
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="mt-1 w-full"
              >
                {isSignUp ? "Create account" : "Sign in"}
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="mt-4 text-center text-xs text-zinc-500">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <Link href="/admin/login" className="font-medium text-zinc-900 hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link
                href="/admin/login?mode=signup"
                className="font-medium text-zinc-900 hover:underline"
              >
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
