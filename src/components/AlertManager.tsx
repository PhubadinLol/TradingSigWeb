"use client";

/**
 * Background watcher for user-configured alert rules. Sends a browser
 * notification only when:
 *  - notifications are enabled and permission is granted,
 *  - the signal for a rule CHANGES to a new BUY/SELL (not on first load),
 *  - its strength meets the rule's minimum, and
 *  - the rule hasn't notified within the cooldown window.
 * At most MAX_RULES rules are polled, and at most one notification per poll.
 */
import { useEffect, useRef } from "react";
import { useApp, withConfig } from "@/components/AppProvider";
import { apiFetch } from "@/hooks/useApi";
import type { SignalResponse } from "@/lib/apiTypes";
import { SIGNAL_LABEL, TIMEFRAME_LABEL } from "@/lib/types";

const STATE_KEY = "tsd:alert-state:v1";
const MAX_RULES = 5;
const POLL_MS = 60_000;

interface RuleState {
  lastKey?: string;
  lastNotified?: number;
}

function loadState(): Record<string, RuleState> {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveState(s: Record<string, RuleState>) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function AlertManager() {
  const { settings, configQuery } = useApp();
  const { enabled, rules, cooldownMinutes } = settings.alerts;
  const running = useRef(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("Notification" in window)) return;
    const active = rules.filter((r) => r.enabled).slice(0, MAX_RULES);
    if (!active.length) return;

    const poll = async () => {
      if (running.current || Notification.permission !== "granted") return;
      running.current = true;
      const state = loadState();
      let sent = false;
      try {
        for (const rule of active) {
          try {
            const res = await apiFetch<SignalResponse>(withConfig(`/api/signal/${rule.symbol}?timeframe=${rule.timeframe}`, configQuery));
            const ev = res.signal.evaluation;
            const key = `${ev.classification}|${res.signal.since}`;
            const rs = state[rule.id] ?? {};
            const isNew = rs.lastKey !== undefined && rs.lastKey !== key;
            const directional = ev.classification !== "NEUTRAL";
            const cooled = !rs.lastNotified || Date.now() - rs.lastNotified > cooldownMinutes * 60_000;
            if (!sent && isNew && directional && ev.strength >= rule.minStrength && cooled) {
              new Notification(`${res.signal.display} ${TIMEFRAME_LABEL[rule.timeframe]}: ${SIGNAL_LABEL[ev.classification]}`, {
                body: `Signal strength ${ev.strength}/100. ${ev.explanation}\n\nEducational analysis only — not financial advice.`,
                tag: `tsd-${rule.id}`,
              });
              rs.lastNotified = Date.now();
              sent = true;
            }
            rs.lastKey = key;
            state[rule.id] = rs;
          } catch {
            /* skip this rule for now */
          }
        }
      } finally {
        saveState(state);
        running.current = false;
      }
    };

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, rules, cooldownMinutes, configQuery]);

  return null;
}
