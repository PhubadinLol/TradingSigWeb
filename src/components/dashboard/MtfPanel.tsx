"use client";

import { Card, cx, ErrorState, SignalBadge, Skeleton, TrendLabel } from "@/components/ui";
import { useMtf } from "@/hooks/data";
import { TIMEFRAME_LABEL } from "@/lib/types";

export function MtfPanel() {
  const { data, error, reload } = useMtf();

  return (
    <Card
      title="Multi-timeframe analysis"
      subtitle={data ? `${data.display} — overall bias weights higher timeframes more` : undefined}
    >
      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-7" />
          ))}
        </div>
      ) : (
        <>
          <table className="w-full text-sm">
            <caption className="sr-only">Signal per timeframe</caption>
            <thead>
              <tr className="text-left text-xs text-muted">
                <th scope="col" className="pb-2 font-medium">TF</th>
                <th scope="col" className="pb-2 font-medium">Trend</th>
                <th scope="col" className="pb-2 font-medium">Signal</th>
                <th scope="col" className="pb-2 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.map((r) => (
                <tr key={r.timeframe}>
                  <th scope="row" className="num py-1.5 text-left font-medium">
                    {TIMEFRAME_LABEL[r.timeframe]}
                    <span className="ml-1 text-[10px] font-normal text-muted">×{r.weight}</span>
                  </th>
                  {r.ok ? (
                    <>
                      <td className="py-1.5"><TrendLabel value={r.trend!} /></td>
                      <td className="py-1.5"><SignalBadge value={r.classification!} /></td>
                      <td className={cx("num py-1.5 text-right", r.score! > 0 ? "text-up" : r.score! < 0 ? "text-down" : "text-muted")}>
                        {r.score! > 0 ? "+" : ""}{r.score}
                      </td>
                    </>
                  ) : (
                    <td colSpan={3} className="py-1.5 text-xs text-muted" title={r.error}>
                      Unavailable
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-panel-2/50 p-3">
            <div>
              <div className="text-xs text-muted">Overall market bias</div>
              <div className="mt-0.5 text-base font-semibold">
                {data.bias.score === null ? "—" : <TrendLabel value={data.bias.label} />}
              </div>
            </div>
            <div className="text-right">
              <div className="num text-base font-semibold">
                {data.bias.score === null ? "—" : `${data.bias.score > 0 ? "+" : ""}${data.bias.score.toFixed(0)}`}
              </div>
              <div className="text-xs text-muted">
                {data.bias.agreeing}/{data.bias.total} timeframes agree
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
