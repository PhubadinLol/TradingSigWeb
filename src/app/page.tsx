"use client";

import { ChartPanel } from "@/components/dashboard/ChartPanel";
import { IndicatorSummary } from "@/components/dashboard/IndicatorSummary";
import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { MtfPanel } from "@/components/dashboard/MtfPanel";
import { SignalCard } from "@/components/dashboard/SignalCard";
import { useAnalysis } from "@/hooks/data";

export default function DashboardPage() {
  const analysis = useAnalysis();
  return (
    <div className="space-y-4">
      <h1 className="sr-only">Dashboard</h1>
      <MarketOverview />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ChartPanel state={analysis} />
        <SignalCard />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <IndicatorSummary state={analysis} />
        <MtfPanel />
      </div>
    </div>
  );
}
