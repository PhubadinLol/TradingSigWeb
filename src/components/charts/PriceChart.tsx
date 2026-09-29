"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  TickMarkType,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { AnalysisResponse } from "@/lib/apiTypes";

export interface ChartToggles {
  emaFast: boolean;
  emaMid: boolean;
  emaSlow: boolean;
  bollinger: boolean;
  levels: boolean;
  markers: boolean;
  volume: boolean;
}

export const DEFAULT_TOGGLES: ChartToggles = {
  emaFast: true,
  emaMid: true,
  emaSlow: true,
  bollinger: false,
  levels: true,
  markers: true,
  volume: true,
};

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const ts = (t: number) => t as UTCTimestamp;

interface Refs {
  chart: IChartApi;
  candles: ISeriesApi<"Candlestick">;
  volume: ISeriesApi<"Histogram">;
  emaFast: ISeriesApi<"Line">;
  emaMid: ISeriesApi<"Line">;
  emaSlow: ISeriesApi<"Line">;
  bbUpper: ISeriesApi<"Line">;
  bbLower: ISeriesApi<"Line">;
  markers: ISeriesMarkersPluginApi<Time>;
  priceLines: IPriceLine[];
}

/** Interactive candlestick chart (zoom with wheel/pinch, drag to scroll). */
export function PriceChart({
  data,
  toggles,
  theme,
  timezone,
  height = 460,
}: {
  data: AnalysisResponse;
  toggles: ChartToggles;
  theme: string;
  timezone: string;
  height?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const refs = useRef<Refs | null>(null);
  const viewKey = useRef<string>("");

  // Create the chart once.
  useEffect(() => {
    if (!container.current) return;
    const chart = createChart(container.current, {
      autoSize: true,
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 4 },
      handleScroll: true,
      handleScale: true,
    });
    const candles = chart.addSeries(CandlestickSeries, { borderVisible: false });
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "volume", lastValueVisible: false, priceLineVisible: false });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    const line = (lineWidth: 1 | 2, style = LineStyle.Solid) =>
      chart.addSeries(LineSeries, { lineWidth, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    refs.current = {
      chart,
      candles,
      volume,
      emaFast: line(1),
      emaMid: line(1),
      emaSlow: line(2),
      bbUpper: line(1, LineStyle.Dotted),
      bbLower: line(1, LineStyle.Dotted),
      markers: createSeriesMarkers(candles, []),
      priceLines: [],
    };
    return () => {
      chart.remove();
      refs.current = null;
      viewKey.current = "";
    };
  }, []);

  // Theme + timezone.
  useEffect(() => {
    const r = refs.current;
    if (!r) return;
    // Wait a frame so the theme class on <html> has been applied.
    const id = requestAnimationFrame(() => {
      const up = cssVar("--up");
      const down = cssVar("--down");
      const fmtOpts = { timeZone: timezone === "local" ? undefined : timezone, hour12: false } as const;
      r.chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: cssVar("--muted"),
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 11,
          attributionLogo: true,
        },
        grid: { vertLines: { color: cssVar("--chart-grid") }, horzLines: { color: cssVar("--chart-grid") } },
        crosshair: { vertLine: { labelBackgroundColor: cssVar("--panel-2") }, horzLine: { labelBackgroundColor: cssVar("--panel-2") } },
        localization: {
          timeFormatter: (t: Time) =>
            new Date((t as number) * 1000).toLocaleString("en-GB", { ...fmtOpts, day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }),
        },
        timeScale: {
          tickMarkFormatter: (t: Time, type: TickMarkType) => {
            const d = new Date((t as number) * 1000);
            if (type === TickMarkType.Year) return d.toLocaleString("en-GB", { ...fmtOpts, year: "numeric" });
            if (type === TickMarkType.Month) return d.toLocaleString("en-GB", { ...fmtOpts, month: "short" });
            if (type === TickMarkType.DayOfMonth) return d.toLocaleString("en-GB", { ...fmtOpts, day: "2-digit", month: "short" });
            return d.toLocaleString("en-GB", { ...fmtOpts, hour: "2-digit", minute: "2-digit" });
          },
        },
      });
      r.candles.applyOptions({ upColor: up, downColor: down, wickUpColor: up, wickDownColor: down });
      r.emaFast.applyOptions({ color: cssVar("--ema-fast") });
      r.emaMid.applyOptions({ color: cssVar("--ema-mid") });
      r.emaSlow.applyOptions({ color: cssVar("--ema-slow") });
      const bb = withAlpha(cssVar("--muted"), 0.8);
      r.bbUpper.applyOptions({ color: bb });
      r.bbLower.applyOptions({ color: bb });
      r.volume.setData(volumeData(data, up, down));
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, timezone]);

  // Data + overlays.
  useEffect(() => {
    const r = refs.current;
    if (!r) return;
    const precision = data.precision;
    r.candles.applyOptions({ priceFormat: { type: "price", precision, minMove: 1 / 10 ** precision } });
    r.candles.setData(data.candles.map((c) => ({ time: ts(c.time), open: c.open, high: c.high, low: c.low, close: c.close })));

    r.volume.applyOptions({ visible: toggles.volume });
    r.volume.setData(volumeData(data, cssVar("--up"), cssVar("--down")));

    const setLine = (s: ISeriesApi<"Line">, pts: { time: number; value: number }[], visible: boolean) => {
      s.applyOptions({ visible });
      s.setData(pts.map((p) => ({ time: ts(p.time), value: p.value })));
    };
    setLine(r.emaFast, data.series.emaFast, toggles.emaFast);
    setLine(r.emaMid, data.series.emaMid, toggles.emaMid);
    setLine(r.emaSlow, data.series.emaSlow, toggles.emaSlow);
    setLine(r.bbUpper, data.series.bbUpper, toggles.bollinger);
    setLine(r.bbLower, data.series.bbLower, toggles.bollinger);

    // Support / resistance lines.
    r.priceLines.forEach((pl) => r.candles.removePriceLine(pl));
    r.priceLines = [];
    if (toggles.levels) {
      const up = cssVar("--up");
      const down = cssVar("--down");
      data.supports.forEach((l, i) =>
        r.priceLines.push(
          r.candles.createPriceLine({ price: l.price, color: withAlpha(up, 0.7), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `S${i + 1}` }),
        ),
      );
      data.resistances.forEach((l, i) =>
        r.priceLines.push(
          r.candles.createPriceLine({ price: l.price, color: withAlpha(down, 0.7), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `R${i + 1}` }),
        ),
      );
    }

    // Buy / sell markers.
    const markers: SeriesMarker<Time>[] = toggles.markers
      ? data.markers.map((m) => {
          const buy = m.classification === "BUY" || m.classification === "STRONG_BUY";
          const strong = m.classification.startsWith("STRONG");
          return {
            time: ts(m.time),
            position: buy ? "belowBar" : "aboveBar",
            shape: buy ? "arrowUp" : "arrowDown",
            color: buy ? cssVar("--up") : cssVar("--down"),
            text: `${strong ? "S" : ""}${buy ? "BUY" : "SELL"}`,
            size: strong ? 1.2 : 0.9,
          };
        })
      : [];
    r.markers.setMarkers(markers);

    // Reset the viewport only when the symbol/timeframe changes, not on refresh.
    const key = `${data.symbol}|${data.timeframe}`;
    if (viewKey.current !== key) {
      viewKey.current = key;
      const n = data.candles.length;
      // Defer until autoSize has measured the container, otherwise the range is computed for width 0.
      requestAnimationFrame(() => refs.current?.chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 160), to: n + 4 }));
    }
  }, [data, toggles]);

  return <div ref={container} style={{ height }} className="w-full" role="img" aria-label={`Candlestick chart for ${data.display} ${data.timeframe}`} />;
}

function volumeData(data: AnalysisResponse, up: string, down: string) {
  return data.candles.map((c) => ({
    time: ts(c.time),
    value: c.volume,
    color: withAlpha(c.close >= c.open ? up : down, 0.35),
  }));
}
