import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-6 py-12 text-center">
      {icon ? (
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-400 shadow-sm ring-1 ring-zinc-200">
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        {body ? (
          <div className="max-w-sm text-xs text-zinc-500">{body}</div>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
