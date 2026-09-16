import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  analysisInformationRequests,
  opportunityEvidence,
  valuextractAnalyses,
  valuextractOpportunities,
} from "../db/schema";
import { randomId } from "../crypto";
import { computeTotals, opportunityRoi, resolveOverlaps } from "./calculations";
import { matchTriggersToTaxonomy } from "./taxonomy";
import type { ValuextractReport } from "./schema";

export type Provenance = {
  jobId: string;
  clientId: string;
  versionNo: number;
  skillId: string;
  skillVersion: string;
  model: string;
  rawResponsePath?: string | null;
};

/**
 * Persists a validated report.
 *
 * Every ROI and total written here is recomputed by `calculations.ts` from the
 * validated range endpoints. The model's own `roi` value is kept alongside, in
 * `model_reported_roi`, purely so a discrepancy can be investigated later — it
 * is never displayed as the client-facing figure.
 */
export async function persistAnalysis(
  report: ValuextractReport,
  provenance: Provenance,
): Promise<string> {
  const decisions = resolveOverlaps(report.opportunities);
  const totals = computeTotals(report, decisions);

  const taxonomyMatches = await matchTriggersToTaxonomy(
    report.opportunities.map((op) => ({
      triggerId: op.trigger_id,
      serviceLine: op.service_line,
      agriCategory: op.agri_category,
      opportunityName: op.opportunity_name,
    })),
  );
  const matchByTrigger = new Map(taxonomyMatches.map((m) => [m.triggerId, m]));

  const analysisId = randomId("vxa");

  await db.insert(valuextractAnalyses).values({
    id: analysisId,
    jobId: provenance.jobId,
    clientId: provenance.clientId,
    versionNo: provenance.versionNo,
    clientName: report.client.name,
    industry: report.client.industry,
    period: report.client.period,
    documentType: report.client.document_type,
    currency: report.client.currency,
    reportDate: report.client.report_date ?? null,
    scopeNote: report.analysis_scope.scope_note,
    documentsJson: JSON.stringify(report.analysis_scope.documents),
    entitiesJson: JSON.stringify(report.analysis_scope.entities),
    periodsJson: JSON.stringify(report.analysis_scope.periods),
    agriInsightsJson: JSON.stringify(report.agri_business_insights),
    basisAndLimitationsJson: JSON.stringify(report.basis_and_limitations),
    topPrioritiesJson: JSON.stringify(report.top_priorities),
    clientValueLow: totals.clientValueLow,
    clientValueHigh: totals.clientValueHigh,
    feeLow: totals.feeLow,
    feeHigh: totals.feeHigh,
    overallRoi: totals.overallRoi,
    opportunityCount: totals.opportunityCount,
    skillId: provenance.skillId,
    skillVersion: provenance.skillVersion,
    model: provenance.model,
    rawResponsePath: provenance.rawResponsePath ?? null,
  });

  for (const [index, op] of report.opportunities.entries()) {
    const decision = decisions[index];
    const opportunityId = randomId("vxo");
    const capmatch = op.capmatch ?? null;

    await db.insert(valuextractOpportunities).values({
      id: opportunityId,
      analysisId,
      seq: index + 1,
      triggerId: op.trigger_id,
      opportunityName: op.opportunity_name,
      serviceLine: op.service_line,
      agriCategory: op.agri_category,
      finding: op.finding,
      whyThisMatters: op.why_this_matters,
      howWeCanAssist: op.how_we_can_assist,
      recommendedSolution: op.recommended_solution,
      valueProposition: op.value_proposition,
      engagementJson: JSON.stringify(op.engagement_details),
      calculationJson: JSON.stringify(op.calculation),
      clientValueLow: op.client_value_low,
      clientValueHigh: op.client_value_high,
      valueType: op.value_type,
      feeLow: op.fee_low,
      feeHigh: op.fee_high,
      roi: opportunityRoi(op),
      modelReportedRoi: op.roi,
      priority: op.priority,
      timeline: op.timeline,
      confidence: op.confidence,
      overlapGroup: decision.overlapGroup,
      excludedFromTotals: decision.excludedFromTotals,
      taxonomyMatchJson: JSON.stringify(matchByTrigger.get(op.trigger_id) ?? null),
      capmatchEligible: capmatch?.capmatch_eligible ?? false,
      capitalRequirementLow: capmatch?.capital_requirement_low ?? null,
      capitalRequirementHigh: capmatch?.capital_requirement_high ?? null,
      possibleFundingCategoriesJson: JSON.stringify(
        capmatch?.possible_funding_categories ?? [],
      ),
    });

    for (const [evidenceIndex, evidence] of op.financial_evidence.entries()) {
      await db.insert(opportunityEvidence).values({
        id: randomId("vxe"),
        opportunityId,
        seq: evidenceIndex + 1,
        evidenceType: evidence.evidence_type,
        description: evidence.description,
        financialPeriod: evidence.financial_period,
        sourceDocument: evidence.source_document,
        sourceSection: evidence.source_section,
        sourcePage:
          evidence.source_page === null || evidence.source_page === undefined
            ? null
            : String(evidence.source_page),
      });
    }
  }

  for (const [index, request] of report.additional_information_requested.entries()) {
    await db.insert(analysisInformationRequests).values({
      id: randomId("vxi"),
      analysisId,
      seq: index + 1,
      item: request.item,
      why: request.why,
      relatedTriggerId: request.related_trigger_id ?? null,
    });
  }

  return analysisId;
}

/* ------------------------------------------------------------- read model */

export type AnalysisView = Awaited<ReturnType<typeof loadAnalysis>>;

export async function loadAnalysis(analysisId: string) {
  const [analysis] = await db
    .select()
    .from(valuextractAnalyses)
    .where(eq(valuextractAnalyses.id, analysisId))
    .limit(1);
  if (!analysis) return null;

  const opportunities = await db
    .select()
    .from(valuextractOpportunities)
    .where(eq(valuextractOpportunities.analysisId, analysisId))
    .orderBy(valuextractOpportunities.seq);

  const evidenceRows = await Promise.all(
    opportunities.map((op) =>
      db
        .select()
        .from(opportunityEvidence)
        .where(eq(opportunityEvidence.opportunityId, op.id))
        .orderBy(opportunityEvidence.seq),
    ),
  );

  const informationRequests = await db
    .select()
    .from(analysisInformationRequests)
    .where(eq(analysisInformationRequests.analysisId, analysisId))
    .orderBy(analysisInformationRequests.seq);

  const parseArray = <T>(json: string, fallback: T[]): T[] => {
    try {
      const value = JSON.parse(json);
      return Array.isArray(value) ? (value as T[]) : fallback;
    } catch {
      return fallback;
    }
  };

  return {
    ...analysis,
    documents: parseArray<string>(analysis.documentsJson, []),
    entities: parseArray<string>(analysis.entitiesJson, []),
    periods: parseArray<string>(analysis.periodsJson, []),
    agriInsights: parseArray<string>(analysis.agriInsightsJson, []),
    basisAndLimitations: parseArray<string>(analysis.basisAndLimitationsJson, []),
    topPriorities: parseArray<{ trigger_id: string; reason: string }>(
      analysis.topPrioritiesJson,
      [],
    ),
    informationRequests,
    opportunities: opportunities.map((op, index) => ({
      ...op,
      engagement: safeParse(op.engagementJson) as {
        duration: string;
        resources: string[];
        timeline: string;
        pricing: string;
      },
      calculation: safeParse(op.calculationJson) as {
        basis: string;
        formula: string;
        assumptions: string[];
      },
      fundingCategories: parseArray<string>(op.possibleFundingCategoriesJson ?? "[]", []),
      evidence: evidenceRows[index] ?? [],
    })),
  };
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function listAnalysesForClient(clientId: string) {
  return db
    .select()
    .from(valuextractAnalyses)
    .where(eq(valuextractAnalyses.clientId, clientId))
    .orderBy(desc(valuextractAnalyses.createdAt));
}

export async function latestAnalysisForClient(clientId: string) {
  const [row] = await db
    .select()
    .from(valuextractAnalyses)
    .where(
      and(
        eq(valuextractAnalyses.clientId, clientId),
        eq(valuextractAnalyses.isArchived, false),
      ),
    )
    .orderBy(desc(valuextractAnalyses.createdAt))
    .limit(1);
  return row ?? null;
}
