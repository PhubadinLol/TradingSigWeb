"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Badge, Button, Card, cx, Field, inputClass, LoadingState, PageHeader } from "@/components/ui";
import type { StatusResponse } from "@/lib/apiTypes";
import type { ConfigOverrides } from "@/lib/config";
import {
  INDICATOR_FIELDS,
  RISK_FIELDS,
  THRESHOLD_FIELDS,
  TIMEZONES,
  type AlertRule,
  type FieldSpec,
} from "@/lib/settingsSchema";
import { FEATURED_SYMBOLS, SYMBOLS } from "@/lib/symbols";
import { TIMEFRAMES, TIMEFRAME_LABEL, type Timeframe } from "@/lib/types";

function serverDefault(cfg: StatusResponse["config"], key: keyof ConfigOverrides): number {
  if (key in cfg.thresholds) return cfg.thresholds[key as keyof typeof cfg.thresholds];
  if (key === "atrStopMultiplier" || key === "tp1R" || key === "tp2R") return cfg.risk[key];
  return cfg.indicators[key as keyof typeof cfg.indicators] as number;
}

/** Numeric input bound to an engine override. Empty or default value clears the override. */
function OverrideInput({ spec, cfg }: { spec: FieldSpec; cfg: StatusResponse["config"] }) {
  const { settings, updateSettings } = useApp();
  const def = serverDefault(cfg, spec.key);
  const current = settings.overrides[spec.key] ?? def;
  const [draft, setDraft] = useState(String(current));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft(String(current)), [current]);

  const commit = () => {
    const raw = draft.trim();
    const setOverride = (v: number | undefined) =>
      updateSettings((s) => {
        const o = { ...s.overrides };
        if (v === undefined || v === def) delete o[spec.key];
        else o[spec.key] = v;
        return { ...s, overrides: o };
      });
    if (raw === "") {
      setOverride(undefined);
      setError(null);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < spec.min || n > spec.max || (spec.integer && !Number.isInteger(n))) {
      setError(`${spec.integer ? "Whole number" : "Value"} between ${spec.min} and ${spec.max}`);
      return;
    }
    setError(null);
    setOverride(n);
  };

  const id = `set-${spec.key}`;
  const overridden = settings.overrides[spec.key] !== undefined;
  return (
    <Field label={spec.label} htmlFor={id} error={error} hint={overridden ? `Custom · server default ${def}` : spec.help ?? `Server default`}>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        className={cx(inputClass, overridden && "border-accent/60")}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        aria-invalid={!!error}
      />
    </Field>
  );
}

function crossFieldError(cfg: StatusResponse["config"], o: ConfigOverrides): string | null {
  const v = (k: keyof ConfigOverrides) => o[k] ?? serverDefault(cfg, k);
  if (!(v("emaFast") < v("emaMid") && v("emaMid") < v("emaSlow"))) return "EMA periods must satisfy fast < mid < slow.";
  if (!(v("strongBuy") > v("buy"))) return "Strong buy threshold must be greater than buy.";
  if (!(v("strongSell") < v("sell"))) return "Strong sell threshold must be less than sell.";
  if (!(v("tp2R") > v("tp1R"))) return "Take profit 2 should be further than take profit 1.";
  return null;
}

function AlertsSection() {
  const { settings, updateSettings, symbol, timeframe } = useApp();
  const alerts = settings.alerts;
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [draft, setDraft] = useState<{ symbol: string; timeframe: Timeframe; minStrength: number }>({ symbol, timeframe, minStrength: 60 });

  useEffect(() => {
    setPermission(typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported");
  }, []);

  const setAlerts = (patch: Partial<typeof alerts>) => updateSettings((s) => ({ ...s, alerts: { ...s.alerts, ...patch } }));

  const enable = async (on: boolean) => {
    if (on && permission !== "granted" && permission !== "unsupported") {
      const p = await Notification.requestPermission();
      setPermission(p);
      if (p !== "granted") return;
    }
    setAlerts({ enabled: on });
  };

  const addRule = () => {
    if (alerts.rules.length >= 5) return;
    const rule: AlertRule = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, enabled: true, ...draft };
    setAlerts({ rules: [...alerts.rules, rule] });
  };

  return (
    <Card title="Notification settings" subtitle="Optional browser notifications when a watched market turns BUY or SELL.">
      {permission === "unsupported" ? (
        <p className="text-sm text-muted">This browser does not support notifications.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={alerts.enabled} onChange={(e) => enable(e.target.checked)} />
              Enable notifications
            </label>
            <Badge tone={permission === "granted" ? "up" : permission === "denied" ? "down" : "neutral"}>Permission: {permission}</Badge>
          </div>
          {permission === "denied" && <p className="text-xs text-down">Notifications are blocked for this site. Allow them in your browser&apos;s site settings.</p>}
          <p className="text-xs text-muted">
            To avoid noise: only a <em>change</em> to a new BUY/SELL signal triggers an alert, at most one per rule per cooldown, one per check, max 5 rules, checked once a minute while this tab is open.
          </p>
          <div className="max-w-40">
            <Field label="Cooldown (minutes)" htmlFor="al-cool">
              <input
                id="al-cool"
                type="number"
                min={5}
                max={1440}
                className={inputClass}
                value={alerts.cooldownMinutes}
                onChange={(e) => setAlerts({ cooldownMinutes: Math.min(1440, Math.max(5, Number(e.target.value) || 30)) })}
              />
            </Field>
          </div>

          <div className="rounded-lg border border-border">
            <div className="grid grid-cols-2 gap-3 border-b border-border p-3 md:grid-cols-4">
              <Field label="Symbol" htmlFor="al-sym">
                <select id="al-sym" className={inputClass} value={draft.symbol} onChange={(e) => setDraft((d) => ({ ...d, symbol: e.target.value }))}>
                  {SYMBOLS.map((s) => <option key={s.id} value={s.id}>{s.display}</option>)}
                </select>
              </Field>
              <Field label="Timeframe" htmlFor="al-tf">
                <select id="al-tf" className={inputClass} value={draft.timeframe} onChange={(e) => setDraft((d) => ({ ...d, timeframe: e.target.value as Timeframe }))}>
                  {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{TIMEFRAME_LABEL[tf]}</option>)}
                </select>
              </Field>
              <Field label="Min. signal strength" htmlFor="al-min">
                <input id="al-min" type="number" min={0} max={100} className={inputClass} value={draft.minStrength} onChange={(e) => setDraft((d) => ({ ...d, minStrength: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))} />
              </Field>
              <div className="flex items-end">
                <Button onClick={addRule} disabled={alerts.rules.length >= 5} className="w-full">Add alert</Button>
              </div>
            </div>
            {alerts.rules.length === 0 ? (
              <p className="p-3 text-sm text-muted">No alert rules yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {alerts.rules.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-[var(--accent)]"
                        checked={r.enabled}
                        onChange={(e) => setAlerts({ rules: alerts.rules.map((x) => (x.id === r.id ? { ...x, enabled: e.target.checked } : x)) })}
                      />
                      <span className="font-medium">{SYMBOLS.find((s) => s.id === r.symbol)?.display ?? r.symbol}</span>
                      <span className="num text-muted">{TIMEFRAME_LABEL[r.timeframe]} · strength ≥ {r.minStrength}</span>
                    </label>
                    <Button variant="ghost" onClick={() => setAlerts({ rules: alerts.rules.filter((x) => x.id !== r.id) })} aria-label={`Remove alert for ${r.symbol} ${r.timeframe}`}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, status, statusError } = useApp();
  const cfg = status?.config;
  const cross = cfg ? crossFieldError(cfg, settings.overrides) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Saved in this browser. Engine settings are sent with each request and validated by the server."
        action={
          <Button onClick={() => confirm("Reset all settings to defaults?") && resetSettings()} variant="secondary">
            Reset all settings
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Appearance & time">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Theme" htmlFor="s-theme">
              <select id="s-theme" className={inputClass} value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as "dark" | "light" })}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </Field>
            <Field label="Timezone" htmlFor="s-tz">
              <select id="s-tz" className={inputClass} value={settings.timezone} onChange={(e) => updateSettings({ timezone: e.target.value })}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz === "local" ? "Browser local time" : tz}</option>)}
              </select>
            </Field>
            <Field label="Auto-refresh" htmlFor="s-refresh">
              <select id="s-refresh" className={inputClass} value={settings.refreshSeconds} onChange={(e) => updateSettings({ refreshSeconds: Number(e.target.value) })}>
                {[15, 30, 60, 120, 300].map((s) => <option key={s} value={s}>Every {s < 60 ? `${s}s` : `${s / 60} min`}</option>)}
              </select>
            </Field>
          </div>
        </Card>

        <Card title="Data provider settings">
          {statusError ? (
            <p className="text-sm text-down">{statusError}</p>
          ) : !status ? (
            <LoadingState />
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted">Active provider:</span>
                <span className="font-medium">{status.meta.providerName}</span>
                <Badge tone={status.meta.isLive ? "up" : "warn"}>{status.meta.isLive ? "Live data" : "Demo data"}</Badge>
              </div>
              {status.meta.warning && <p className="rounded-md bg-warn-soft px-3 py-2 text-xs text-warn">{status.meta.warning}</p>}
              <p className="text-xs leading-relaxed text-muted">
                The provider is configured on the server so API keys never reach the browser. Set <code className="num text-fg">MARKET_DATA_PROVIDER</code> (
                <code className="num">mock</code>, <code className="num">binance</code> or <code className="num">twelvedata</code>) and, for Twelve Data,{" "}
                <code className="num text-fg">TWELVE_DATA_API_KEY</code> in <code className="num text-fg">.env.local</code>, then restart the server. See README.
              </p>
            </div>
          )}
        </Card>
      </div>

      {cross && <p role="alert" className="rounded-md bg-down-soft px-3 py-2 text-sm text-down">{cross} Requests will fail until this is fixed.</p>}

      {!cfg ? (
        <LoadingState label="Loading server defaults…" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card
            title="Indicator settings"
            action={<ResetGroup keys={INDICATOR_FIELDS.map((f) => f.key)} />}
          >
            <div className="grid grid-cols-2 gap-3">
              {INDICATOR_FIELDS.map((f) => <OverrideInput key={f.key} spec={f} cfg={cfg} />)}
            </div>
          </Card>
          <Card title="Signal thresholds" subtitle="signalScore = buyScore − sellScore (−100…+100)" action={<ResetGroup keys={THRESHOLD_FIELDS.map((f) => f.key)} />}>
            <div className="grid grid-cols-2 gap-3">
              {THRESHOLD_FIELDS.map((f) => <OverrideInput key={f.key} spec={f} cfg={cfg} />)}
            </div>
            <div className="mt-4 rounded-lg border border-border p-3 text-xs">
              <p className="mb-2 font-medium text-muted">Scoring weights (server)</p>
              <ul className="num grid grid-cols-2 gap-1 text-muted">
                <li>EMA alignment: {cfg.weights.emaAlignment}</li>
                <li>Price vs EMA slow: {cfg.weights.priceVsEmaSlow}</li>
                <li>RSI vs 50: {cfg.weights.rsi}</li>
                <li>MACD: {cfg.weights.macd}</li>
                <li>Breakout/down: {cfg.weights.breakout}</li>
                <li>Volume: {cfg.weights.volume}</li>
                <li>S/R reaction: {cfg.weights.srReaction}</li>
              </ul>
            </div>
          </Card>
          <Card title="Risk settings" action={<ResetGroup keys={RISK_FIELDS.map((f) => f.key)} />}>
            <div className="grid grid-cols-2 gap-3">
              {RISK_FIELDS.map((f) => <OverrideInput key={f.key} spec={f} cfg={cfg} />)}
              <Field label="Default balance (USD)" htmlFor="s-bal">
                <input
                  id="s-bal"
                  type="number"
                  min={1}
                  className={inputClass}
                  value={settings.risk.accountBalance}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v > 0) updateSettings((s) => ({ ...s, risk: { ...s.risk, accountBalance: v } }));
                  }}
                />
              </Field>
              <Field label="Default risk per trade (%)" htmlFor="s-risk" hint="Used by the risk calculator">
                <input
                  id="s-risk"
                  type="number"
                  min={0.1}
                  max={100}
                  step={0.1}
                  className={inputClass}
                  value={settings.risk.riskPct}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v > 0 && v <= 100) updateSettings((s) => ({ ...s, risk: { ...s.risk, riskPct: v } }));
                  }}
                />
              </Field>
            </div>
          </Card>
        </div>
      )}

      <AlertsSection />
      <p className="text-xs text-muted">Featured markets: {FEATURED_SYMBOLS.map((s) => s.display).join(", ")}.</p>
    </div>
  );
}

function ResetGroup({ keys }: { keys: (keyof ConfigOverrides)[] }) {
  const { settings, updateSettings } = useApp();
  const any = keys.some((k) => settings.overrides[k] !== undefined);
  if (!any) return null;
  return (
    <button
      onClick={() =>
        updateSettings((s) => {
          const o = { ...s.overrides };
          keys.forEach((k) => delete o[k]);
          return { ...s, overrides: o };
        })
      }
      className="text-xs text-accent hover:underline"
    >
      Reset to defaults
    </button>
  );
}
