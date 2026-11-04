import type { ReactNode } from "react";

/** Shared atoms for the desktop renderer (console and workspace). */

export const inputClass =
  "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50";

export const labelClass =
  "mb-1 block text-xs font-bold uppercase tracking-wide text-muted-foreground";

export function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Btn({
  children,
  onClick,
  variant = "default",
  disabled,
  title,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "outline" | "live";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const styles =
    variant === "outline"
      ? "border bg-transparent hover:bg-muted"
      : variant === "live"
        ? "bg-live text-destructive-foreground"
        : "bg-primary text-primary-foreground hover:opacity-90";
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-bold ${ok ? "bg-primary/20 text-primary" : "bg-destructive text-destructive-foreground"}`}
    >
      {children}
    </span>
  );
}

/** Labelled form control. */
export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}
