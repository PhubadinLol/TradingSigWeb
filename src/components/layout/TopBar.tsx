"use client";

import { useApp } from "@/components/AppProvider";
import { Icons } from "@/components/icons";
import { SymbolSearch } from "@/components/layout/SymbolSearch";
import { cx } from "@/components/ui";
import { FEATURED_SYMBOLS, SYMBOLS } from "@/lib/symbols";
import { TIMEFRAMES, TIMEFRAME_LABEL } from "@/lib/types";

export function TimeframeSelector({ className }: { className?: string }) {
  const { timeframe, setTimeframe } = useApp();
  return (
    <div role="group" aria-label="Timeframe" className={cx("flex rounded-md border border-border bg-panel-2 p-0.5", className)}>
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          aria-pressed={tf === timeframe}
          onClick={() => setTimeframe(tf)}
          className={cx(
            "num min-w-8 rounded px-1.5 py-1 text-xs font-medium transition-colors sm:min-w-9 sm:px-2",
            tf === timeframe ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg",
          )}
        >
          {TIMEFRAME_LABEL[tf]}
        </button>
      ))}
    </div>
  );
}

export function MarketSelector() {
  const { symbol, setSymbol } = useApp();
  const inFeatured = FEATURED_SYMBOLS.some((s) => s.id === symbol);
  const current = SYMBOLS.find((s) => s.id === symbol);
  return (
    <select
      aria-label="Market"
      value={symbol}
      onChange={(e) => setSymbol(e.target.value)}
      className="rounded-md border border-border bg-panel-2 px-2 py-1.5 text-sm font-medium focus:border-accent focus:outline-none"
    >
      {!inFeatured && current && <option value={current.id}>{current.display}</option>}
      {FEATURED_SYMBOLS.map((s) => (
        <option key={s.id} value={s.id}>
          {s.display}
        </option>
      ))}
    </select>
  );
}

export function ConnectionStatus({ compact = false }: { compact?: boolean }) {
  const { status, statusError } = useApp();
  let label = "Connecting…";
  let tone = "bg-muted";
  let title = "Checking the data provider";
  if (statusError) {
    label = "Offline";
    tone = "bg-down";
    title = statusError;
  } else if (status) {
    if (status.meta.isLive) {
      label = `Live · ${status.meta.providerName}`;
      tone = "bg-up";
      title = `Live market data from ${status.meta.providerName}`;
    } else {
      label = "Demo data";
      tone = "bg-warn";
      title = "Synthetic demo data — connect a market data provider for live prices";
    }
  }
  return (
    <span title={title} className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs whitespace-nowrap text-muted" aria-live="polite">
      <span className={cx("size-2 rounded-full", tone)} aria-hidden />
      {compact ? (
        <>
          <span aria-hidden>{status?.meta.isLive ? "Live" : statusError ? "Offline" : "Demo"}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        label
      )}
    </span>
  );
}

export function ThemeToggle() {
  const { settings, updateSettings } = useApp();
  const dark = settings.theme === "dark";
  return (
    <button
      onClick={() => updateSettings({ theme: dark ? "light" : "dark" })}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="grid size-8 place-items-center rounded-md border border-border text-muted hover:bg-panel-2 hover:text-fg"
    >
      {dark ? <Icons.sun /> : <Icons.moon />}
    </button>
  );
}

export function TopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-4">
        <button onClick={onMenu} className="grid size-8 place-items-center rounded-md text-muted hover:bg-panel-2 lg:hidden" aria-label="Open navigation">
          <Icons.menu />
        </button>
        <SymbolSearch className="w-40 sm:w-56" />
        <MarketSelector />
        <TimeframeSelector className="hidden xl:flex" />
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline-flex">
            <ConnectionStatus />
          </span>
          <ThemeToggle />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 overflow-x-auto px-4 pb-2 xl:hidden">
        <TimeframeSelector />
        <span className="sm:hidden">
          <ConnectionStatus compact />
        </span>
      </div>
    </header>
  );
}
