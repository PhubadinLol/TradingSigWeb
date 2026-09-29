"use client";

import { BaselineSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Cumulative R equity curve. Green above zero, red below. */
export function EquityChart({ points, theme, height = 240 }: { points: { time: number; value: number }[]; theme: string; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Baseline"> | null>(null);

  useEffect(() => {
    if (!el.current) return;
    chart.current = createChart(el.current, {
      autoSize: true,
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true },
      handleScroll: false,
      handleScale: false,
    });
    series.current = chart.current.addSeries(BaselineSeries, {
      baseValue: { type: "price", price: 0 },
      lineWidth: 2,
      priceFormat: { type: "custom", formatter: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}R` },
    });
    return () => {
      chart.current?.remove();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (!chart.current || !series.current) return;
      chart.current.applyOptions({
        layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: cssVar("--muted"), fontSize: 11 },
        grid: { vertLines: { color: cssVar("--chart-grid") }, horzLines: { color: cssVar("--chart-grid") } },
      });
      const up = cssVar("--up");
      const down = cssVar("--down");
      series.current.applyOptions({
        topLineColor: up,
        topFillColor1: `${up}40`,
        topFillColor2: `${up}05`,
        bottomLineColor: down,
        bottomFillColor1: `${down}05`,
        bottomFillColor2: `${down}40`,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [theme]);

  useEffect(() => {
    if (!series.current || !chart.current) return;
    series.current.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    chart.current.timeScale().fitContent();
  }, [points]);

  return <div ref={el} style={{ height }} className="w-full" role="img" aria-label="Equity curve in R multiples" />;
}
