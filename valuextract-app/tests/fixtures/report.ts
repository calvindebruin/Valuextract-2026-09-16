import type { ValuextractReport } from "@/lib/valuextract/schema";

/** A minimal report that satisfies the Skill's canonical schema. */
export function sampleOpportunity(
  overrides: Partial<ValuextractReport["opportunities"][number]> = {},
): ValuextractReport["opportunities"][number] {
  return {
    trigger_id: "AGRI_WC_01",
    opportunity_name: "Working capital and input financing review",
    service_line: "Corporate Finance",
    agri_category: "Working capital",
    financial_evidence: [
      {
        evidence_type: "Fact",
        description: "Trade receivables of R18.4m against revenue of R96.2m.",
        financial_period: "FY2026",
        source_document: "Annual Financial Statements FY2026",
        source_section: "Note 8 — Trade and other receivables",
        source_page: 24,
      },
    ],
    finding: "Debtor days lengthened from 46 to 70 while overdraft utilisation rose.",
    why_this_matters: "Cash is tied up through the pre-harvest period at overdraft rates.",
    how_we_can_assist: "Structure a working capital programme and renegotiate facilities.",
    recommended_solution: "Build a 13-week cash forecast and reprice the overdraft.",
    engagement_details: {
      duration: "8 weeks",
      resources: ["Corporate finance manager", "Agricultural analyst"],
      timeline: "Quick (0-3 months)",
      pricing: "Fixed Fee",
    },
    value_proposition: "Releases cash and lowers finance cost within one season.",
    calculation: {
      basis: "Reduction of debtor days from 70 to 55 on FY2026 revenue.",
      formula: "(70 - 55) / 365 * 96,200,000",
      assumptions: ["Revenue remains at FY2026 levels."],
    },
    client_value_low: 2_000_000,
    client_value_high: 4_000_000,
    value_type: "Cash release",
    fee_low: 200_000,
    fee_high: 400_000,
    roi: 10,
    priority: "HIGH",
    timeline: "Quick (0-3 months)",
    confidence: "High",
    ...overrides,
  };
}

export function sampleReport(
  overrides: Partial<ValuextractReport> = {},
): ValuextractReport {
  return {
    client: {
      name: "JJ Gouws Boerdery (Pty) Ltd",
      industry: "Agriculture — deciduous fruit",
      period: "Year ended 28 February 2026",
      document_type: "Annual Financial Statements and Management Accounts",
      currency: "ZAR",
      report_date: null,
    },
    analysis_scope: {
      documents: ["JJ Gouws AFS FY2026.pdf"],
      entities: ["JJ Gouws Boerdery (Pty) Ltd"],
      periods: ["FY2025", "FY2026"],
      scope_note: "Management accounts are unaudited.",
    },
    agri_business_insights: ["Gross margin declined from 31.8% to 24.6%."],
    opportunities: [sampleOpportunity()],
    top_priorities: [{ trigger_id: "AGRI_WC_01", reason: "Fastest cash release." }],
    additional_information_requested: [
      { item: "Facility letters", why: "Interest rates were not supplied.", related_trigger_id: "AGRI_WC_01" },
    ],
    basis_and_limitations: ["Indicative values, not a guarantee of results."],
    ...overrides,
  };
}
