import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clients, financialDocuments, valuextractAnalyses } from "@/lib/db/schema";
import { requireApiUser } from "@/lib/auth/guards";
import { badRequest, handleRoute, notFound } from "@/lib/api/handler";
import { createAnalysisJob, startAnalysisJob } from "@/lib/jobs/runner";
import { getAiConfig } from "@/lib/config/ai-config";
import { bootstrap } from "@/lib/bootstrap";

const bodySchema = z.object({
  clientId: z.string().min(1),
  /** Omit to analyse every document currently held for the client. */
  documentIds: z.array(z.string().min(1)).optional(),
  supersedesAnalysisId: z.string().min(1).optional().nullable(),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    await bootstrap();
    const user = await requireApiUser();
    const input = bodySchema.parse(await request.json());

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, input.clientId))
      .limit(1);
    if (!client) throw notFound("Client not found.");

    // Configuration is checked before a job is created, so a misconfigured
    // deployment reports the real problem instead of a failed analysis.
    const config = await getAiConfig();
    if (!config.apiKey) {
      throw badRequest(
        "MISSING_API_KEY",
        "ValueXtract is not connected to Anthropic yet. An administrator must add the API key.",
      );
    }
    if (!config.skillId) {
      throw badRequest(
        "MISSING_SKILL_ID",
        "The ValueXtract Agri Skill has not been configured yet. An administrator must set the Skill ID.",
      );
    }

    const allDocuments = await db
      .select()
      .from(financialDocuments)
      .where(eq(financialDocuments.clientId, input.clientId));

    const selected = input.documentIds?.length
      ? allDocuments.filter((d) => input.documentIds!.includes(d.id))
      : allDocuments;

    if (selected.length === 0) {
      throw badRequest(
        "NO_DOCUMENTS",
        "Upload annual financial statements or management accounts before running an analysis.",
      );
    }
    const hasFinancials = selected.some(
      (d) =>
        d.category === "ANNUAL_FINANCIAL_STATEMENTS" || d.category === "MANAGEMENT_ACCOUNTS",
    );
    if (!hasFinancials) {
      throw badRequest(
        "NO_DOCUMENTS",
        "Supporting information alone is not enough. Add annual financial statements or management accounts.",
      );
    }

    if (input.supersedesAnalysisId) {
      const [prior] = await db
        .select({ id: valuextractAnalyses.id })
        .from(valuextractAnalyses)
        .where(eq(valuextractAnalyses.id, input.supersedesAnalysisId))
        .limit(1);
      if (!prior) throw notFound("The analysis being replaced no longer exists.");
    }

    const { job, created } = await createAnalysisJob({
      clientId: input.clientId,
      documentIds: selected.map((d) => d.id),
      userId: user.id,
      supersedesAnalysisId: input.supersedesAnalysisId ?? null,
    });

    if (created) startAnalysisJob(job.id);

    return NextResponse.json(
      { jobId: job.id, status: job.status, alreadyRunning: !created },
      { status: created ? 202 : 200 },
    );
  });
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    await bootstrap();
    await requireApiUser();
    const url = new URL(request.url);
    const clientId = url.searchParams.get("clientId");
    const rows = clientId
      ? await db
          .select()
          .from(valuextractAnalyses)
          .where(eq(valuextractAnalyses.clientId, clientId))
      : await db.select().from(valuextractAnalyses).limit(100);

    const clientIds = [...new Set(rows.map((r) => r.clientId))];
    const clientRows = clientIds.length
      ? await db.select().from(clients).where(inArray(clients.id, clientIds))
      : [];
    const nameById = new Map(clientRows.map((c) => [c.id, c.name]));

    return NextResponse.json({
      analyses: rows.map((r) => ({
        id: r.id,
        clientId: r.clientId,
        clientName: nameById.get(r.clientId) ?? r.clientName,
        versionNo: r.versionNo,
        currency: r.currency,
        clientValueLow: r.clientValueLow,
        clientValueHigh: r.clientValueHigh,
        overallRoi: r.overallRoi,
        opportunityCount: r.opportunityCount,
        isArchived: r.isArchived,
        createdAt: r.createdAt,
      })),
    });
  });
}
