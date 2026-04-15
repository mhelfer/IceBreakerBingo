import { headers } from "next/headers";

const SAFE_HOST = /^[a-zA-Z0-9._-]+(:\d+)?$/;

export async function getOrigin(): Promise<string> {
  const envOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (envOrigin) return envOrigin.replace(/\/$/, "");
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  if (!SAFE_HOST.test(host)) return "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") === "https" ? "https" : "http";
  return `${proto}://${host}`;
}
