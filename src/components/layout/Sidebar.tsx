"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/icons";
import { cx } from "@/components/ui";

export const NAV = [
  { href: "/", label: "Dashboard", icon: Icons.dashboard },
  { href: "/markets", label: "Markets", icon: Icons.markets },
  { href: "/signals", label: "Signals", icon: Icons.signals },
  { href: "/chart", label: "Chart", icon: Icons.chart },
  { href: "/backtest", label: "Backtest", icon: Icons.backtest },
  { href: "/analytics", label: "Performance", icon: Icons.analytics },
  { href: "/risk", label: "Risk Calculator", icon: Icons.risk },
  { href: "/settings", label: "Settings", icon: Icons.settings },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <span className="grid size-7 place-items-center rounded-md bg-accent text-xs font-bold text-white" aria-hidden>
          TS
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">SignalDesk</div>
          <div className="text-[11px] text-muted">Technical analysis</div>
        </div>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-panel-2 hover:text-fg",
                )}
              >
                <Icon />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-border p-4 text-[11px] leading-relaxed text-muted">
        Educational tool. Not financial advice.
      </p>
    </nav>
  );
}
