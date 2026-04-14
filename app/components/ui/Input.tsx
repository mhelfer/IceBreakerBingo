import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const base =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 " +
  "focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 " +
  "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500";

export function Input({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${base} ${className}`.trim()} />;
}

export function Textarea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      className={`${base} font-mono text-xs leading-relaxed ${className}`.trim()}
    />
  );
}

export function Select({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={`${base} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22none%22 stroke=%22%2371717a%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%223 5 6 8 9 5%22/></svg>')] bg-[right_0.75rem_center] bg-no-repeat pr-9 ${className}`.trim()}
    >
      {children}
    </select>
  );
}

export function Label({
  children,
  htmlFor,
  className = "",
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-xs font-medium text-zinc-700 ${className}`.trim()}
    >
      {children}
    </label>
  );
}
