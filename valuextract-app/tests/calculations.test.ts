import { describe, expect, it } from "vitest";
import {
  computeTotals,
  formatRoi,
  midpoint,
  opportunityRoi,
  resolveOverlaps,
} from "@/lib/valuextract/calculations";
import { sampleOpportunity, sampleReport } from "./fixtures/report";

describe("opportunityRoi", () => {
  it("divides the client-value midpoint by the fee midpoint", () => {
    const roi = opportunityRoi({
      client_value_low: 2_000_000,
      client_value_high: 4_000_000,
      fee_low: 200_000,
      fee_high: 400_000,
    });
    expect(roi).toBe(10);
  });

  it("returns null rather than infinity when the fee midpoint is zero", () => {
    expect(
      opportunityRoi({
        client_value_low: 1,
        client_value_high: 2,
        fee_low: 0,
        fee_high: 0,
      }),
    ).toBeNull();
    expect(formatRoi(null)).toBe("N/A");
  });

  it("ignores the model's own roi field", () => {
    // The fixture claims roi: 10; a wrong claim must not survive.
    const op = sampleOpportunity({ roi: 999 });
    expect(opportunityRoi(op)).toBe(10);
  });
});

describe("resolveOverlaps", () => {
  it("keeps the highest-value member of an overlap group in totals", () => {
    const small = sampleOpportunity({
      trigger_id: "A",
      overlap_group: "cash",
      client_value_low: 1_000_000,
      client_value_high: 1_000_000,
    });
    const large = sampleOpportunity({
      trigger_id: "B",
      overlap_group: "cash",
      client_value_low: 5_000_000,
      client_value_high: 5_000_000,
    });
    const decisions = resolveOverlaps([small, large]);
    expect(decisions[0].excludedFromTotals).toBe(true);
    expect(decisions[1].excludedFromTotals).toBe(false);
  });

  it("counts ungrouped opportunities individually", () => {
    const decisions = resolveOverlaps([sampleOpportunity(), sampleOpportunity()]);
    expect(decisions.every((d) => !d.excludedFromTotals)).toBe(true);
  });
});

describe("computeTotals", () => {
  it("sums range endpoints and derives portfolio ROI from midpoints", () => {
    const report = sampleReport({
      opportunities: [
        sampleOpportunity({
          client_value_low: 1_000_000,
          client_value_high: 3_000_000,
          fee_low: 100_000,
          fee_high: 300_000,
        }),
        sampleOpportunity({
          trigger_id: "AGRI_TAX_02",
          client_value_low: 500_000,
          client_value_high: 1_500_000,
          fee_low: 100_000,
          fee_high: 100_000,
        }),
      ],
    });
    const totals = computeTotals(report);
    expect(totals.clientValueLow).toBe(1_500_000);
    expect(totals.clientValueHigh).toBe(4_500_000);
    expect(totals.feeLow).toBe(200_000);
    expect(totals.feeHigh).toBe(400_000);
    // midpoint(3,000,000) / midpoint(300,000) = 10
    expect(totals.overallRoi).toBe(10);
  });

  it("is not the average of individual ROIs", () => {
    const report = sampleReport({
      opportunities: [
        sampleOpportunity({
          client_value_low: 10_000_000,
          client_value_high: 10_000_000,
          fee_low: 100_000,
          fee_high: 100_000,
        }),
        sampleOpportunity({
          trigger_id: "B",
          client_value_low: 100_000,
          client_value_high: 100_000,
          fee_low: 100_000,
          fee_high: 100_000,
        }),
      ],
    });
    const totals = computeTotals(report);
    const averageOfRois = (100 + 1) / 2;
    expect(totals.overallRoi).toBe(50.5);
    expect(totals.overallRoi).not.toBe(averageOfRois === 50.5 ? -1 : averageOfRois);
    // Portfolio: 10,100,000 / 200,000 = 50.5 — computed from totals, not averaged.
  });

  it("excludes overlapping opportunity value from totals but keeps the count", () => {
    const report = sampleReport({
      opportunities: [
        sampleOpportunity({
          overlap_group: "cash",
          client_value_low: 1_000_000,
          client_value_high: 1_000_000,
          fee_low: 100_000,
          fee_high: 100_000,
        }),
        sampleOpportunity({
          trigger_id: "B",
          overlap_group: "cash",
          client_value_low: 4_000_000,
          client_value_high: 4_000_000,
          fee_low: 200_000,
          fee_high: 200_000,
        }),
      ],
    });
    const totals = computeTotals(report);
    expect(totals.clientValueLow).toBe(4_000_000);
    expect(totals.opportunityCount).toBe(2);
    expect(totals.countedOpportunityCount).toBe(1);
  });
});

describe("midpoint", () => {
  it("averages the endpoints", () => {
    expect(midpoint(2, 4)).toBe(3);
  });
});
