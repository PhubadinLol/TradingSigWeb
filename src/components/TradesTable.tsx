"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Badge, Button, cx, SignalBadge } from "@/components/ui";
import type { TradeRow } from "@/lib/apiTypes";
import { formatDateTime, formatPrice, formatR } from "@/lib/format";
import { TIMEFRAME_LABEL, type TradeStatus } from "@/lib/types";

const STATUS_TONE: Record<TradeStatus, "accent" | "up" | "down" | "neutral"> = {
  Active: "accent",
  "Target Hit": "up",
  "Stop Hit": "down",
  Expired: "neutral",
};

export function TradesTable({ rows, pageSize = 50, caption }: { rows: TradeRow[]; pageSize?: number; caption: string }) {
  const { settings } = useApp();
  const [shown, setShown] = useState(pageSize);
  const visible = rows.slice(0, shown);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th scope="col" className="px-4 py-2 font-medium">Time</th>
              <th scope="col" className="px-4 py-2 font-medium">Symbol</th>
              <th scope="col" className="px-4 py-2 font-medium">Timeframe</th>
              <th scope="col" className="px-4 py-2 font-medium">Signal</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Score</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Entry</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">SL</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">TP</th>
              <th scope="col" className="px-4 py-2 font-medium">Status</th>
              <th scope="col" className="px-4 py-2 text-right font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((t) => (
              <tr key={t.id} className="hover:bg-panel-2/50">
                <td className="num px-4 py-2 whitespace-nowrap text-muted">{formatDateTime(t.signalTime, settings.timezone)}</td>
                <td className="px-4 py-2 font-medium whitespace-nowrap">{t.display}</td>
                <td className="num px-4 py-2">{TIMEFRAME_LABEL[t.timeframe]}</td>
                <td className="px-4 py-2"><SignalBadge value={t.signal} /></td>
                <td className={cx("num px-4 py-2 text-right", t.score > 0 ? "text-up" : "text-down")}>{t.score > 0 ? "+" : ""}{t.score}</td>
                <td className="num px-4 py-2 text-right">{formatPrice(t.entry, t.precision)}</td>
                <td className="num px-4 py-2 text-right text-down">{formatPrice(t.stopLoss, t.precision)}</td>
                <td className="num px-4 py-2 text-right text-up">{formatPrice(t.takeProfit, t.precision)}</td>
                <td className="px-4 py-2"><Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge></td>
                <td className={cx("num px-4 py-2 text-right", t.rMultiple > 0 ? "text-up" : t.rMultiple < 0 ? "text-down" : "text-muted")}>
                  {formatR(t.rMultiple)}
                  {t.status === "Active" && <span className="block text-[10px] text-muted">unrealised</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown && (
        <div className="flex justify-center border-t border-border p-3">
          <Button onClick={() => setShown((s) => s + pageSize)}>Show more ({rows.length - shown} remaining)</Button>
        </div>
      )}
    </div>
  );
}
