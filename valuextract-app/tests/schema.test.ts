import { describe, expect, it } from "vitest";
import { validateReport } from "@/lib/valuextract/schema";
import { sampleOpportunity, sampleReport } from "./fixtures/report";

describe("validateReport", () => {
  it("accepts a report that matches the Skill's canonical schema", () => {
    const result = validateReport(sampleReport());
    expect(result.ok).toBe(true);
  });

  it("rejects an opportunity with no financial evidence", () => {
    const result = validateReport(
      sampleReport({ opportunities: [sampleOpportunity({ financial_evidence: [] })] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(" ")).toMatch(/financial_evidence/);
    }
  });

  it("rejects an unknown timeline value", () => {
    const result = validateReport(
      sampleReport({
        opportunities: [
          sampleOpportunity({ timeline: "Soon" as unknown as "Quick (0-3 months)" }),
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a non-ISO currency code", () => {
    const base = sampleReport();
    const result = validateReport({
      ...base,
      client: { ...base.client, currency: "Rand" },
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a null source page and never requires one", () => {
    const result = validateReport(
      sampleReport({
        opportunities: [
          sampleOpportunity({
            financial_evidence: [
              {
                evidence_type: "Calculation",
                description: "Gross margin recomputed from the detailed income statement.",
                financial_period: "FY2026",
                source_document: "Management Accounts",
                source_section: "Detailed income statement",
                source_page: null,
              },
            ],
          }),
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects zero or negative money values", () => {
    const result = validateReport(
      sampleReport({ opportunities: [sampleOpportunity({ fee_low: 0 })] }),
    );
    expect(result.ok).toBe(false);
  });

  it("tolerates the optional CapMatch extension", () => {
    const result = validateReport(
      sampleReport({
        opportunities: [
          sampleOpportunity({
            capmatch: {
              capmatch_eligible: true,
              capital_requirement_low: 10_000_000,
              capital_requirement_high: 15_000_000,
              possible_funding_categories: ["Senior debt", "Mezzanine"],
            },
          }),
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("returns readable issue paths instead of throwing", () => {
    const result = validateReport({ nonsense: true });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThan(0);
  });
});
