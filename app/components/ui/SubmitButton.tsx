"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { buttonClass } from "./Button";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export function SubmitButton({
  variant = "secondary",
  size = "md",
  children,
  className = "",
}: {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${buttonClass(variant, size)} ${className}`.trim()}
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : children}
    </button>
  );
}
