import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

type Tone = "info" | "warning" | "success";

const TONES: Record<Tone, { bg: string; fg: string; icon: typeof Info }> = {
  info: {
    bg: "border-zinc-200 bg-zinc-50",
    fg: "text-zinc-700",
    icon: Info,
  },
  warning: {
    bg: "border-amber-200 bg-amber-50",
    fg: "text-amber-900",
    icon: AlertTriangle,
  },
  success: {
    bg: "border-emerald-200 bg-emerald-50",
    fg: "text-emerald-900",
    icon: CheckCircle2,
  },
};

export function Banner({
  tone = "info",
  children,
  action,
}: {
  tone?: Tone;
  children: ReactNode;
  action?: ReactNode;
}) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${t.bg} ${t.fg}`}
      role={tone === "warning" ? "alert" : undefined}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1 leading-relaxed">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
