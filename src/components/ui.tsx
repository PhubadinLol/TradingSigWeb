/** Small, reusable presentational components. */
import type { ReactNode } from "react";
import { SIGNAL_LABEL, type SignalClass, type Trend } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("rounded-xl border border-border bg-panel", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

const SIGNAL_TONE: Record<SignalClass, string> = {
  STRONG_BUY: "bg-up text-white",
  BUY: "bg-up-soft text-up",
  NEUTRAL: "bg-panel-2 text-muted",
  SELL: "bg-down-soft text-down",
  STRONG_SELL: "bg-down text-white",
};

export function SignalBadge({ value, size = "sm" }: { value: SignalClass; size?: "sm" | "lg" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-md font-semibold tracking-wide whitespace-nowrap",
        size === "lg" ? "px-3 py-1.5 text-2xl" : "px-2 py-0.5 text-xs",
        SIGNAL_TONE[value],
      )}
    >
      {SIGNAL_LABEL[value]}
    </span>
  );
}

export function signalTextColor(value: SignalClass | null | undefined) {
  if (value === "BUY" || value === "STRONG_BUY") return "text-up";
  if (value === "SELL" || value === "STRONG_SELL") return "text-down";
  return "text-muted";
}

export function TrendLabel({ value }: { value: Trend }) {
  const tone = value === "Bullish" ? "text-up" : value === "Bearish" ? "text-down" : "text-muted";
  const arrow = value === "Bullish" ? "▲" : value === "Bearish" ? "▼" : "■";
  return (
    <span className={cx("inline-flex items-center gap-1 font-medium", tone)}>
      <span aria-hidden className="text-[0.7em]">
        {arrow}
      </span>
      {value}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "up" | "down" | "warn" | "accent" }) {
  const tones = {
    neutral: "bg-panel-2 text-muted border-border",
    up: "bg-up-soft text-up border-transparent",
    down: "bg-down-soft text-down border-transparent",
    warn: "bg-warn-soft text-warn border-transparent",
    accent: "bg-accent-soft text-accent border-transparent",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-md bg-panel-2", className)} aria-hidden />;
}

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cx("flex min-h-32 flex-col items-center justify-center gap-3 text-sm text-muted", className)}>
      <span className="size-5 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cx("flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg bg-down-soft p-4 text-center text-sm", className)}>
      <p className="font-medium text-down">Couldn’t load data</p>
      <p className="max-w-md text-muted">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-md border border-border bg-panel px-3 py-1.5 text-xs font-medium hover:bg-panel-2">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, className }: { title: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex min-h-32 flex-col items-center justify-center gap-2 p-4 text-center text-sm", className)}>
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-md text-muted">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: "up" | "down" | "muted" }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className={cx("num mt-0.5 truncate text-base font-semibold", tone === "up" && "text-up", tone === "down" && "text-down", tone === "muted" && "text-muted")}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Button({
  children,
  variant = "secondary",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  const v = {
    primary: "bg-accent text-white hover:opacity-90 border-transparent",
    secondary: "bg-panel border-border hover:bg-panel-2",
    ghost: "bg-transparent border-transparent hover:bg-panel-2",
  };
  return (
    <button
      {...rest}
      className={cx("inline-flex items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50", v[variant], className)}
    >
      {children}
    </button>
  );
}

export const inputClass =
  "w-full rounded-md border border-border bg-panel-2 px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none";

export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-muted">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-down">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
