import type { ReactNode } from "react";
import { HeaderBar } from "./HeaderBar";

export default async function EventLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ eventCode: string }>;
}) {
  const { eventCode } = await params;
  return (
    <div className="min-h-screen bg-zinc-50/40">
      <HeaderBar eventCode={eventCode} />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}
