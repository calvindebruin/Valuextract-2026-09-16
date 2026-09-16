import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  analysisInformationRequests,
  analysisJobDocuments,
  analysisJobs,
  analysisUsage,
  apiRequestLog,
  clients,
  financialDocuments,
  valuextractAnalyses,
  type AnalysisJobStatus,
} from "../db/schema";
import { randomId } from "../crypto";
import { AnalysisError, classifyError, redact } from "../errors";
import { resolveAnthropic } from "../anthropic/client";
import { runValuextractAgri, type DocumentInput } from "../anthropic/run-analysis";
import { validateReport } from "../valuextract/schema";
import { persistAnalysis } from "../valuextract/persist";
import { putObject } from "../storage";

/**
 * In-process analysis job runner.
 *
 * Jobs are recorded in the database first, then executed on a detached
 * promise, so the HTTP request that starts an analysis returns immediately and
 * the client polls the job. State transitions are honest: `stage` only
 * advances when the corresponding work has actually begun — no fabricated
 * progress.
 */

export const ACTIVE_STATUSES: AnalysisJobStatus[] = ["QUEUED", "PROCESSING", "VALIDATING"];

export const STAGES = [
  "Documents received",
  "Transferring documents",
  "Analysing financial information",
  "Reading structured results",
  "Validating and saving",
] as const;

const running = new Set<string>();

async function log(kind: string, status: string, detail?: string, durationMs?: number) {
  try {
    await db.insert(apiRequestLog).values({
      id: randomId("log"),
      kind,
      status,
      detail: detail ? redact(detail) : null,
      durationMs: durationMs ?? null,
    });
  } catch {
    // Logging must never break an analysis.
  }
}

async function setStage(jobId: string, stage: string, status?: AnalysisJobStatus) {
  await db
    .update(analysisJobs)
    .set({ stage, ...(status ? { status } : {}) })
    .where(eq(analysisJobs.id, jobId));
}

export async function findActiveJob(clientId: string) {
  const [job] = await db
    .select()
    .from(analysisJobs)
    .where(and(eq(analysisJobs.clientId, clientId), inArray(analysisJobs.status, ACTIVE_STATUSES)))
    .orderBy(desc(analysisJobs.createdAt))
    .limit(1);
  return job ?? null;
}

export type CreateJobInput = {
  clientId: string;
  documentIds: string[];
  userId: string;
  /** Set when this run enhances an earlier analysis with new information. */
  supersedesAnalysisId?: string | null;
};

export async function createAnalysisJob(input: CreateJobInput) {
  const existing = await findActiveJob(input.clientId);
  if (existing) {
    return { job: existing, created: false as const };
  }

  const priorCount = await db
    .select({ id: analysisJobs.id })
    .from(analysisJobs)
    .where(eq(analysisJobs.clientId, input.clientId));

  const jobId = randomId("job");
  const config = await import("../config/ai-config").then((m) => m.getAiConfig());

  await db.insert(analysisJobs).values({
    id: jobId,
    clientId: input.clientId,
    status: "QUEUED",
    stage: STAGES[0],
    skillId: config.skillId,
    skillVersion: config.skillVersion,
    model: config.model,
    codeExecutionTool: config.codeExecutionTool,
    versionNo: priorCount.length + 1,
    supersedesAnalysisId: input.supersedesAnalysisId ?? null,
    createdBy: input.userId,
  });

  for (const documentId of input.documentIds) {
    await db.insert(analysisJobDocuments).values({ jobId, documentId });
  }

  const [job] = await db.select().from(analysisJobs).where(eq(analysisJobs.id, jobId)).limit(1);
  return { job, created: true as const };
}

/** Fire-and-forget execution. Errors are recorded on the job, never rethrown. */
export function startAnalysisJob(jobId: string): void {
  if (running.has(jobId)) return;
  running.add(jobId);
  void executeJob(jobId)
    .catch(() => undefined)
    .finally(() => running.delete(jobId));
}

async function executeJob(jobId: string): Promise<void> {
  const startedAt = Date.now();

  const [job] = await db.select().from(analysisJobs).where(eq(analysisJobs.id, jobId)).limit(1);
  if (!job || job.status === "COMPLETED") return;

  await db
    .update(analysisJobs)
    .set({ status: "PROCESSING", stage: STAGES[1], startedAt: new Date().toISOString() })
    .where(eq(analysisJobs.id, jobId));

  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, job.clientId)).limit(1);
    if (!client) throw new AnalysisError("UNKNOWN", "Client record is missing.");

    const links = await db
      .select()
      .from(analysisJobDocuments)
      .where(eq(analysisJobDocuments.jobId, jobId));
    if (links.length === 0) throw new AnalysisError("NO_DOCUMENTS");

    const documentRows = await db
      .select()
      .from(financialDocuments)
      .where(
        inArray(
          financialDocuments.id,
          links.map((l) => l.documentId),
        ),
      );

    const documents: DocumentInput[] = documentRows.map((d) => ({
      id: d.id,
      filename: d.filename,
      mimeType: d.mimeType,
      storagePath: d.storagePath,
      category: d.category,
      periodLabel: d.periodLabel,
      anthropicFileId: d.anthropicFileId,
    }));

    const { client: anthropic, config } = await resolveAnthropic();
    if (!config.skillId) throw new AnalysisError("MISSING_SKILL_ID");

    // Carry forward the previous run's outstanding information requests so a
    // follow-up analysis knows what the new documents were meant to answer.
    let priorInformationRequests: string[] | undefined;
    if (job.supersedesAnalysisId) {
      const prior = await db
        .select()
        .from(analysisInformationRequests)
        .where(eq(analysisInformationRequests.analysisId, job.supersedesAnalysisId));
      priorInformationRequests = prior.map((r) => r.item);
    }

    const result = await runValuextractAgri({
      client: anthropic,
      model: config.model,
      skillId: config.skillId,
      skillVersion: config.skillVersion,
      codeExecutionTool: config.codeExecutionTool,
      promptClient: {
        clientId: client.id,
        name: client.name,
        subsector: client.subsector,
        financialYearEnd: client.financialYearEnd,
        currency: client.currency,
      },
      documents,
      priorInformationRequests,
      onStage: (stage) => setStage(jobId, stage),
    });

    await db
      .update(analysisJobs)
      .set({
        status: "VALIDATING",
        stage: STAGES[4],
        containerId: result.containerId,
        resolvedSkillVersion: result.resolvedSkillVersion,
        codeExecutionTool: result.codeExecutionTool,
      })
      .where(eq(analysisJobs.id, jobId));

    const validation = validateReport(result.raw);
    if (!validation.ok) {
      throw new AnalysisError(
        "VALIDATION_FAILED",
        `Schema issues: ${validation.issues.slice(0, 12).join("; ")}`,
      );
    }

    const rawPath = `analyses/${jobId}/valuextract-data.json`;
    await putObject(rawPath, Buffer.from(result.rawText, "utf8"));

    const analysisId = await persistAnalysis(validation.data, {
      jobId,
      clientId: job.clientId,
      versionNo: job.versionNo,
      skillId: config.skillId,
      skillVersion: result.resolvedSkillVersion ?? config.skillVersion,
      model: config.model,
      rawResponsePath: rawPath,
    });

    await db.insert(analysisUsage).values({
      id: randomId("usg"),
      jobId,
      model: config.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cacheReadTokens: result.usage.cacheReadTokens,
      cacheCreationTokens: result.usage.cacheCreationTokens,
      serverToolRequests: result.usage.serverToolRequests,
      apiCalls: result.usage.apiCalls,
      durationMs: result.usage.durationMs,
      // Left null deliberately: no pricing table is hard-coded. A configured
      // central price list can backfill this column later.
      estimatedCost: null,
      costCurrency: null,
    });

    // A superseded analysis stays readable but is no longer the current one.
    if (job.supersedesAnalysisId) {
      await db
        .update(valuextractAnalyses)
        .set({ isArchived: true })
        .where(eq(valuextractAnalyses.id, job.supersedesAnalysisId));
    }

    await db
      .update(analysisJobs)
      .set({
        status: "COMPLETED",
        stage: "Report ready",
        completedAt: new Date().toISOString(),
        errorCode: null,
        errorMessage: null,
      })
      .where(eq(analysisJobs.id, jobId));

    await log("analysis", "COMPLETED", `analysis ${analysisId}`, Date.now() - startedAt);
  } catch (error) {
    const classified = classifyError(error);
    await db
      .update(analysisJobs)
      .set({
        status: "FAILED",
        stage: null,
        errorCode: classified.code,
        errorMessage: redact(classified.detail ?? classified.message),
        completedAt: new Date().toISOString(),
      })
      .where(eq(analysisJobs.id, jobId));
    await log("analysis", `FAILED:${classified.code}`, classified.detail, Date.now() - startedAt);
  }
}
