import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition " +
  "disabled:cursor-not-allowed disabled:opacity-40 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900";

const variants: Record<Variant, string> = {
  primary:
    "bg-zinc-900 text-white hover:bg-zinc-700 disabled:bg-zinc-900",
  secondary:
    "border border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50",
  ghost:
    "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  danger:
    "border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-9 px-3.5 text-sm",
  lg: "h-10 px-4 text-sm",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md"): string {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      className={`${buttonClass(variant, size)} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
