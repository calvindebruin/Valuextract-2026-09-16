import { z } from "zod";

/**
 * Runtime contract for the ValueXtract Agri Skill output.
 *
 * This mirrors `references/report-data.schema.json` inside the Skill bundle —
 * that JSON Schema is the canonical contract; this file is its executable
 * counterpart. Model output is NEVER persisted or rendered without passing
 * through here.
 *
 * A small number of optional extension fields (`overlap_group`, `capmatch`)
 * are accepted but not required, so a Skill version that starts emitting them
 * works without an application change, and one that does not still validates.
 */

export const TIMELINES = [
  "Quick (0-3 months)",
  "Medium (3-9 months)",
  "Strategic (9+ months)",
] as const;

export const PRICING_MODELS = [
  "Fixed Fee",
  "Monthly Retainer",
  "Success Fee",
  "Project Fee",
  "Recurring Fee",
  "Transaction Percentage",
  "Hybrid",
] as const;

export const VALUE_TYPES = [
  "Recurring annual value",
  "Once-off value",
  "Cash release",
  "Capital enabled",
  "Risk-adjusted value",
  "Mixed value",
] as const;

export const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export const CONFIDENCES = ["High", "Medium", "Low"] as const;
export const EVIDENCE_TYPES = ["Fact", "Calculation", "Inference"] as const;

export const evidenceSchema = z.object({
  evidence_type: z.enum(EVIDENCE_TYPES),
  description: z.string().min(1),
  financial_period: z.string().min(1),
  source_document: z.string().min(1),
  source_section: z.string().min(1),
  /** Null whenever a real page number was not visible. Never fabricated. */
  source_page: z.union([z.number().int(), z.string(), z.null()]),
});

export const calculationSchema = z.object({
  basis: z.string().min(1),
  formula: z.string().min(1),
  assumptions: z.array(z.string().min(1)),
});

export const engagementSchema = z.object({
  duration: z.string().min(1),
  resources: z.array(z.string().min(1)).min(1),
  timeline: z.enum(TIMELINES),
  pricing: z.enum(PRICING_MODELS),
});

export const capmatchSchema = z.object({
  capmatch_eligible: z.boolean().default(false),
  capital_requirement_low: z.number().nullable().optional(),
  capital_requirement_high: z.number().nullable().optional(),
  possible_funding_categories: z.array(z.string()).optional().default([]),
});

export const opportunitySchema = z.object({
  trigger_id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  opportunity_name: z.string().min(1),
  service_line: z.string().min(1),
  agri_category: z.string().min(1),
  financial_evidence: z.array(evidenceSchema).min(1),
  finding: z.string().min(1),
  why_this_matters: z.string().min(1),
  how_we_can_assist: z.string().min(1),
  recommended_solution: z.string().min(1),
  engagement_details: engagementSchema,
  value_proposition: z.string().min(1),
  calculation: calculationSchema,
  client_value_low: z.number().positive(),
  client_value_high: z.number().positive(),
  value_type: z.enum(VALUE_TYPES),
  fee_low: z.number().positive(),
  fee_high: z.number().positive(),
  roi: z.number().positive(),
  priority: z.enum(PRIORITIES),
  timeline: z.enum(TIMELINES),
  confidence: z.enum(CONFIDENCES),

  // --- optional extensions, tolerated but never required -------------------
  /** Opportunities sharing a group are counted once in portfolio totals. */
  overlap_group: z.string().nullable().optional(),
  capmatch: capmatchSchema.nullable().optional(),
});

export const valuextractReportSchema = z.object({
  client: z.object({
    name: z.string().min(1),
    industry: z.string().min(1),
    period: z.string().min(1),
    document_type: z.string().min(1),
    currency: z.string().regex(/^[A-Z]{3}$/),
    report_date: z.string().nullable().optional(),
  }),
  analysis_scope: z.object({
    documents: z.array(z.string().min(1)),
    entities: z.array(z.string().min(1)),
    periods: z.array(z.string().min(1)),
    scope_note: z.string(),
  }),
  agri_business_insights: z.array(z.string().min(1)).min(1).max(10),
  opportunities: z.array(opportunitySchema),
  top_priorities: z
    .array(
      z.object({
        trigger_id: z.string().min(1),
        reason: z.string().min(1),
      }),
    )
    .max(3),
  additional_information_requested: z.array(
    z.object({
      item: z.string().min(1),
      why: z.string().min(1),
      related_trigger_id: z.string().nullable().optional(),
    }),
  ),
  basis_and_limitations: z.array(z.string().min(1)),
});

export type Evidence = z.infer<typeof evidenceSchema>;
export type Calculation = z.infer<typeof calculationSchema>;
export type Engagement = z.infer<typeof engagementSchema>;
export type Opportunity = z.infer<typeof opportunitySchema>;
export type ValuextractReport = z.infer<typeof valuextractReportSchema>;

export type ValidationOutcome =
  | { ok: true; data: ValuextractReport }
  | { ok: false; issues: string[] };

/** Validates raw model output. Returns readable issue paths, never throws. */
export function validateReport(input: unknown): ValidationOutcome {
  const parsed = valuextractReportSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    ),
  };
}
