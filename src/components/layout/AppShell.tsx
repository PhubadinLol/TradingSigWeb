"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { AlertManager } from "@/components/AlertManager";
import { Icons } from "@/components/icons";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

export const DISCLAIMER =
  "Trading involves risk. Signals are generated from technical analysis and are provided for educational and informational purposes only. They are not financial advice and do not guarantee profits.";

function DataBanner() {
  const { status } = useApp();
  if (!status) return null;
  if (status.meta.isLive && !status.meta.warning) return null;
  return (
    <div role="status" className="border-b border-border bg-warn-soft px-4 py-2 text-xs text-warn">
      {status.meta.warning ? <strong className="font-semibold">{status.meta.warning} </strong> : null}
      {!status.meta.isLive && (
        <>
          <strong className="font-semibold">Demo Data</strong> — Connect a market data provider for live prices.
        </>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  useEffect(() => setDrawer(false), [pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-panel focus:p-2">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh border-r border-border bg-panel lg:block">
        <Sidebar />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-border bg-panel">
            <button onClick={() => setDrawer(false)} className="absolute top-3 right-3 grid size-8 place-items-center rounded-md text-muted hover:bg-panel-2" aria-label="Close navigation">
              <Icons.close />
            </button>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <TopBar onMenu={() => setDrawer(true)} />
        <DataBanner />
        <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6">
          {children}
        </main>
        <footer className="border-t border-border px-4 py-3 text-center text-[11px] leading-relaxed text-muted md:px-6">{DISCLAIMER}</footer>
      </div>
      <AlertManager />
    </div>
  );
}
