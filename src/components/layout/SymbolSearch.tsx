"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Icons } from "@/components/icons";
import { cx, inputClass } from "@/components/ui";
import { apiFetch } from "@/hooks/useApi";
import type { SymbolSearchResponse } from "@/lib/apiTypes";

/** Accessible combobox for searching supported symbols. */
export function SymbolSearch({ className }: { className?: string }) {
  const { setSymbol } = useApp();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SymbolSearchResponse["results"]>([]);
  const [active, setActive] = useState(0);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      apiFetch<SymbolSearchResponse>(`/api/symbols?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => {
          setResults(r.results);
          setActive(0);
        })
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (id: string) => {
    setSymbol(id);
    setQ("");
    setOpen(false);
  };

  const selectable = results.filter((r) => r.supported);

  return (
    <div ref={boxRef} className={cx("relative", className)}>
      <Icons.search className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Search symbols"
        placeholder="Search symbols…"
        className={cx(inputClass, "py-1.5 pl-8")}
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, selectable.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && selectable[active]) {
            e.preventDefault();
            choose(selectable[active].id);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute z-40 mt-1 max-h-80 w-full min-w-64 overflow-auto rounded-lg border border-border bg-panel p-1 shadow-xl">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matching symbols</li>}
          {results.map((r) => {
            const idx = selectable.indexOf(r);
            return (
              <li
                key={r.id}
                role="option"
                aria-selected={idx === active}
                aria-disabled={!r.supported}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (r.supported) choose(r.id);
                }}
                className={cx(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm",
                  idx === active && "bg-panel-2",
                  !r.supported && "cursor-not-allowed opacity-50",
                )}
              >
                <span>
                  <span className="font-medium">{r.display}</span>
                  <span className="ml-2 text-xs text-muted">{r.name}</span>
                </span>
                <span className="text-[11px] text-muted uppercase">{r.supported ? r.assetClass : "not on provider"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
