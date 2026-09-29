/**
 * Fixed-fractional position sizing: risk a set percentage of the account on
 * each trade, sized so that hitting the stop loses exactly that amount.
 * Pure functions — used by the Risk Calculator page and safe to unit test.
 */

export interface PositionInput {
  balance: number;
  riskPct: number;
  entry: number;
  stopLoss: number;
  takeProfit?: number | null;
}

export interface PositionResult {
  direction: "long" | "short";
  maxRiskAmount: number;
  /** Units of the base asset. */
  positionSize: number;
  positionValue: number;
  potentialLoss: number;
  potentialProfit: number | null;
  riskReward: number | null;
  stopDistancePct: number;
  warnings: string[];
}

export type PositionError = { error: string };

export function calculatePosition(input: PositionInput): PositionResult | PositionError {
  const { balance, riskPct, entry, stopLoss, takeProfit } = input;
  if (!(balance > 0)) return { error: "Account balance must be greater than 0." };
  if (!(riskPct > 0 && riskPct <= 100)) return { error: "Risk percentage must be between 0 and 100." };
  if (!(entry > 0)) return { error: "Entry price must be greater than 0." };
  if (!(stopLoss > 0)) return { error: "Stop-loss price must be greater than 0." };
  if (entry === stopLoss) return { error: "Stop loss cannot equal the entry price." };

  const direction = stopLoss < entry ? "long" : "short";
  const perUnitRisk = Math.abs(entry - stopLoss);
  const maxRiskAmount = balance * (riskPct / 100);
  const positionSize = maxRiskAmount / perUnitRisk;
  const positionValue = positionSize * entry;

  let potentialProfit: number | null = null;
  let riskReward: number | null = null;
  const warnings: string[] = [];

  if (takeProfit !== undefined && takeProfit !== null && Number.isFinite(takeProfit) && takeProfit > 0) {
    const correctSide = direction === "long" ? takeProfit > entry : takeProfit < entry;
    if (!correctSide) {
      warnings.push(
        direction === "long"
          ? "Take profit is below entry for a long trade (stop is below entry)."
          : "Take profit is above entry for a short trade (stop is above entry).",
      );
    } else {
      const perUnitReward = Math.abs(takeProfit - entry);
      potentialProfit = perUnitReward * positionSize;
      riskReward = perUnitReward / perUnitRisk;
      if (riskReward < 1) warnings.push("Reward is smaller than risk (R:R below 1:1).");
    }
  }

  if (riskPct > 2) {
    warnings.push("Risking more than 1–2% of the account per trade is widely considered aggressive.");
  }
  if (positionValue > balance) {
    warnings.push(
      "Position value exceeds the account balance, which would require leverage. This calculator does not recommend using leverage — consider a wider stop with a smaller position, or skipping the trade.",
    );
  }

  return {
    direction,
    maxRiskAmount,
    positionSize,
    positionValue,
    potentialLoss: maxRiskAmount,
    potentialProfit,
    riskReward,
    stopDistancePct: (perUnitRisk / entry) * 100,
    warnings,
  };
}
