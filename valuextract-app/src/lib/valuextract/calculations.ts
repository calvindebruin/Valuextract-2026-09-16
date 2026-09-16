import type { Opportunity, ValuextractReport } from "./schema";

/**
 * Deterministic arithmetic.
 *
 * Nothing arithmetic that a client sees is taken from model prose. Every ROI
 * and every total displayed in the report and the PDF is recomputed here from
 * the validated range endpoints, following the Skill's stated rules:
 *
 *   opportunity ROI = midpoint(client value) / midpoint(fee)
 *   portfolio  ROI  = midpoint(total client value) / midpoint(total fees)
 *
 * Portfolio ROI is explicitly NOT the average of opportunity ROIs.
 */

export function midpoint(low: number, high: number): number {
  return (low + high) / 2;
}

export function round(value: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Indicative ROI for one opportunity, or null when the fee midpoint is zero. */
export function opportunityRoi(op: Pick<
  Opportunity,
  "client_value_low" | "client_value_high" | "fee_low" | "fee_high"
>): number | null {
  const feeMid = midpoint(op.fee_low, op.fee_high);
  if (!Number.isFinite(feeMid) || feeMid <= 0) return null;
  const valueMid = midpoint(op.client_value_low, op.client_value_high);
  if (!Number.isFinite(valueMid)) return null;
  return round(valueMid / feeMid, 2);
}

export type OverlapDecision = {
  /** Stable index into the original opportunity array. */
  index: number;
  overlapGroup: string | null;
  /** True when this opportunity's value is suppressed to avoid double counting. */
  excludedFromTotals: boolean;
};

/**
 * Overlap control. When the Skill flags two opportunities as addressing the
 * same underlying value (`overlap_group`), only the highest-value member of
 * the group contributes to portfolio totals. The others stay visible in the
 * report, flagged, rather than being silently dropped.
 */
export function resolveOverlaps(opportunities: Opportunity[]): OverlapDecision[] {
  const bestByGroup = new Map<string, { index: number; value: number }>();

  opportunities.forEach((op, index) => {
    const group = op.overlap_group?.trim();
    if (!group) return;
    const value = midpoint(op.client_value_low, op.client_value_high);
    const current = bestByGroup.get(group);
    if (!current || value > current.value) bestByGroup.set(group, { index, value });
  });

  return opportunities.map((op, index) => {
    const group = op.overlap_group?.trim() || null;
    const winner = group ? bestByGroup.get(group) : undefined;
    return {
      index,
      overlapGroup: group,
      excludedFromTotals: Boolean(group && winner && winner.index !== index),
    };
  });
}

export type PortfolioTotals = {
  clientValueLow: number;
  clientValueHigh: number;
  feeLow: number;
  feeHigh: number;
  /** Null when the fee midpoint is zero — rendered as N/A, never as 0.0x. */
  overallRoi: number | null;
  opportunityCount: number;
  countedOpportunityCount: number;
  /** Distinct currencies seen. Totals are only meaningful when this is 1. */
  currency: string;
};

export function computeTotals(
  report: ValuextractReport,
  decisions: OverlapDecision[] = resolveOverlaps(report.opportunities),
): PortfolioTotals {
  const excluded = new Set(
    decisions.filter((d) => d.excludedFromTotals).map((d) => d.index),
  );

  let clientValueLow = 0;
  let clientValueHigh = 0;
  let feeLow = 0;
  let feeHigh = 0;
  let counted = 0;

  report.opportunities.forEach((op, index) => {
    if (excluded.has(index)) return;
    clientValueLow += op.client_value_low;
    clientValueHigh += op.client_value_high;
    feeLow += op.fee_low;
    feeHigh += op.fee_high;
    counted += 1;
  });

  const feeMid = midpoint(feeLow, feeHigh);
  const overallRoi =
    feeMid > 0 ? round(midpoint(clientValueLow, clientValueHigh) / feeMid, 2) : null;

  return {
    clientValueLow: round(clientValueLow),
    clientValueHigh: round(clientValueHigh),
    feeLow: round(feeLow),
    feeHigh: round(feeHigh),
    overallRoi,
    opportunityCount: report.opportunities.length,
    countedOpportunityCount: counted,
    currency: report.client.currency,
  };
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  ZAR: "R",
  USD: "$",
  EUR: "€",
  GBP: "£",
  NAD: "N$",
  BWP: "P",
};

function currencyPrefix(currency: string): string {
  const code = /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : "ZAR";
  return CURRENCY_SYMBOLS[code] ?? `${code} `;
}

/**
 * Currency formatting used by the UI, the PDF layout and the print view.
 *
 * Deliberately hand-rolled rather than `Intl.NumberFormat`: ICU data differs
 * between the Node server and the browser (en-ZA renders compact values as
 * "R 3,4M" on one and "R 3.4M" on the other), which breaks hydration. A fixed
 * format also matches South African advisory convention — R42.3m, R320k.
 */
export function formatMoney(
  value: number | null | undefined,
  currency: string,
  opts: { compact?: boolean } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";

  const prefix = currencyPrefix(currency);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (opts.compact) {
    const units: [number, string][] = [
      [1_000_000_000, "bn"],
      [1_000_000, "m"],
      [1_000, "k"],
    ];
    for (const [scale, suffix] of units) {
      if (abs >= scale) {
        const scaled = abs / scale;
        // One decimal below 100 units, none above, so a table stays legible
        // without implying precision the source does not support.
        const text = scaled >= 100 ? scaled.toFixed(0) : trimZero(scaled.toFixed(1));
        return `${sign}${prefix}${text}${suffix}`;
      }
    }
  }

  return `${sign}${prefix}${groupThousands(Math.round(abs))}`;
}

function trimZero(text: string): string {
  return text.endsWith(".0") ? text.slice(0, -2) : text;
}

function groupThousands(value: number): string {
  const digits = String(value);
  let out = "";
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += " ";
    out += digits[i];
  }
  return out;
}

export function formatRoi(roi: number | null | undefined): string {
  if (roi === null || roi === undefined || !Number.isFinite(roi)) return "N/A";
  return `${roi.toFixed(1)}x`;
}
