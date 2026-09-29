"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Button, Card, cx, Field, inputClass, PageHeader, Stat } from "@/components/ui";
import { useSignal } from "@/hooks/data";
import { formatMoney, formatNumber, formatPct } from "@/lib/format";
import { calculatePosition } from "@/lib/risk";

interface Form {
  balance: string;
  riskPct: string;
  entry: string;
  stop: string;
  tp: string;
}

function RiskCalculator() {
  const { settings, updateSettings } = useApp();
  const params = useSearchParams();
  const signal = useSignal();
  const [form, setForm] = useState<Form>({
    balance: String(settings.risk.accountBalance),
    riskPct: String(settings.risk.riskPct),
    entry: params.get("entry") ?? "",
    stop: params.get("sl") ?? "",
    tp: params.get("tp") ?? "",
  });

  // Pick up persisted defaults once settings hydrate.
  useEffect(() => {
    setForm((f) => ({ ...f, balance: String(settings.risk.accountBalance), riskPct: String(settings.risk.riskPct) }));
  }, [settings.risk.accountBalance, settings.risk.riskPct]);

  const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
  const result = useMemo(
    () =>
      calculatePosition({
        balance: num(form.balance),
        riskPct: num(form.riskPct),
        entry: num(form.entry),
        stopLoss: num(form.stop),
        takeProfit: form.tp.trim() === "" ? null : num(form.tp),
      }),
    [form],
  );
  const incomplete = [form.balance, form.riskPct, form.entry, form.stop].some((v) => v.trim() === "");

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const setup = signal.data?.signal.evaluation.setup;
  const precision = signal.data?.signal.precision ?? 2;
  const useSignalLevels = () => {
    if (!setup) return;
    setForm((f) => ({
      ...f,
      entry: ((setup.entryLow + setup.entryHigh) / 2).toFixed(precision),
      stop: setup.stopLoss.toFixed(precision),
      tp: setup.takeProfit1.toFixed(precision),
    }));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Card title="Inputs" subtitle="Fixed-fractional sizing: the position is sized so that hitting the stop loses exactly your chosen risk.">
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Account balance (USD)" htmlFor="r-bal">
              <input id="r-bal" inputMode="decimal" type="number" min={0} step="any" className={inputClass} value={form.balance} onChange={set("balance")} />
            </Field>
            <Field label="Risk per trade (%)" htmlFor="r-pct" hint="1–2% is a common ceiling">
              <input id="r-pct" inputMode="decimal" type="number" min={0.01} max={100} step="0.1" className={inputClass} value={form.riskPct} onChange={set("riskPct")} />
            </Field>
          </div>
          <Field label="Entry price" htmlFor="r-entry">
            <input id="r-entry" inputMode="decimal" type="number" min={0} step="any" className={inputClass} value={form.entry} onChange={set("entry")} />
          </Field>
          <Field label="Stop-loss price" htmlFor="r-sl" hint="Below entry = long, above entry = short">
            <input id="r-sl" inputMode="decimal" type="number" min={0} step="any" className={inputClass} value={form.stop} onChange={set("stop")} />
          </Field>
          <Field label="Take-profit price (optional)" htmlFor="r-tp">
            <input id="r-tp" inputMode="decimal" type="number" min={0} step="any" className={inputClass} value={form.tp} onChange={set("tp")} />
          </Field>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" onClick={useSignalLevels} disabled={!setup} title={setup ? undefined : "Current signal is neutral — no levels"}>
              Use current signal levels
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const b = Number(form.balance);
                const r = Number(form.riskPct);
                if (b > 0 && r > 0 && r <= 100) updateSettings((s) => ({ ...s, risk: { accountBalance: b, riskPct: r } }));
              }}
            >
              Save balance &amp; risk as default
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Result">
        <div aria-live="polite">
        {incomplete ? (
          <p className="text-sm text-muted">Enter balance, risk %, entry and stop loss to calculate a position size.</p>
        ) : "error" in result ? (
          <p role="alert" className="text-sm text-down">{result.error}</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-xs text-muted">
              Direction:
              <span className={cx("font-semibold uppercase", result.direction === "long" ? "text-up" : "text-down")}>{result.direction}</span>
              <span>· stop {formatPct(result.stopDistancePct)} from entry</span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="Maximum risk amount" value={formatMoney(result.maxRiskAmount)} />
              <Stat label="Position size (units)" value={formatNumber(result.positionSize, 6)} />
              <Stat label="Position value" value={formatMoney(result.positionValue)} />
              <Stat label="Potential loss" value={`−${formatMoney(result.potentialLoss)}`} tone="down" />
              <Stat label="Potential profit" value={result.potentialProfit === null ? "—" : `+${formatMoney(result.potentialProfit)}`} tone={result.potentialProfit === null ? "muted" : "up"} />
              <Stat label="Risk / reward" value={result.riskReward === null ? "—" : `1 : ${result.riskReward.toFixed(2)}`} />
            </div>
            {result.warnings.length > 0 && (
              <ul className="space-y-2">
                {result.warnings.map((w) => (
                  <li key={w} className="rounded-md bg-warn-soft px-3 py-2 text-xs text-warn">{w}</li>
                ))}
              </ul>
            )}
            <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted">
              Figures ignore fees, spread, slippage and gaps, which can make real losses larger than planned. This tool does not recommend using leverage.
            </p>
          </div>
        )}
        </div>
      </Card>
    </div>
  );
}

export default function RiskPage() {
  return (
    <div>
      <PageHeader title="Risk calculator" description="Work out a position size from your account balance and the distance to your stop loss." />
      <Suspense>
        <RiskCalculator />
      </Suspense>
    </div>
  );
}
