import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { analysisJobs, valuextractAnalyses } from "@/lib/db/schema";
import { requireApiUser } from "@/lib/auth/guards";
import { handleRoute, notFound } from "@/lib/api/handler";
import { userFacingMessage, type AnalysisErrorCode } from "@/lib/errors";
import { STAGES } from "@/lib/jobs/runner";
import { bootstrap } from "@/lib/bootstrap";

/** Polled by the analysis screen. Returns honest stage information only. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  return handleRoute(async () => {
    await bootstrap();
    await requireApiUser();
    const { jobId } = await context.params;

    const [job] = await db
      .select()
      .from(analysisJobs)
      .where(eq(analysisJobs.id, jobId))
      .limit(1);
    if (!job) throw notFound("Analysis job not found.");

    const [analysis] = await db
      .select({ id: valuextractAnalyses.id })
      .from(valuextractAnalyses)
      .where(eq(valuextractAnalyses.jobId, jobId))
      .limit(1);

    const stageIndex = job.stage ? STAGES.indexOf(job.stage as (typeof STAGES)[number]) : -1;

    return NextResponse.json({
      id: job.id,
      clientId: job.clientId,
      status: job.status,
      stage: job.stage,
      stages: STAGES,
      stageIndex,
      versionNo: job.versionNo,
      analysisId: analysis?.id ?? null,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error:
        job.status === "FAILED"
          ? {
              code: job.errorCode,
              message: userFacingMessage(job.errorCode as AnalysisErrorCode | null),
            }
          : null,
    });
  });
}
