"use client";

import { ChartPanel } from "@/components/dashboard/ChartPanel";
import { IndicatorSummary } from "@/components/dashboard/IndicatorSummary";
import { PageHeader } from "@/components/ui";
import { useAnalysis } from "@/hooks/data";

export default function ChartPage() {
  const analysis = useAnalysis(1000);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Chart"
        description="Candlesticks with EMA overlays, Bollinger Bands, support/resistance and historical engine signals. Arrows mark where the engine's classification turned BUY or SELL."
      />
      <ChartPanel state={analysis} height={620} />
      <IndicatorSummary state={analysis} />
    </div>
  );
}
