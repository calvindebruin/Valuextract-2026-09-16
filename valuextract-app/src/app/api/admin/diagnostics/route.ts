import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { analysisJobs, analysisUsage, apiRequestLog } from "@/lib/db/schema";
import { requireApiAdmin } from "@/lib/auth/guards";
import { handleRoute } from "@/lib/api/handler";
import { getAiConfig, toPublicConfig } from "@/lib/config/ai-config";
import { verifySkill } from "@/lib/anthropic/skill-registry";
import { env } from "@/lib/env";
import { bootstrap } from "@/lib/bootstrap";

/** Admin-only. Reports configuration state and never the secret itself. */
export async function GET() {
  return handleRoute(async () => {
    await bootstrap();
    await requireApiAdmin();

    const config = await getAiConfig();
    const publicConfig = toPublicConfig(config);

    let skillReachable: boolean | null = null;
    let skillDetail: string | null = null;
    if (config.apiKey && config.skillId) {
      const verification = await verifySkill();
      skillReachable = verification.ok;
      skillDetail = verification.ok
        ? `${verification.skill.displayName} · ${verification.resolvedVersion}`
        : verification.message;
    }

    const [lastRequest] = await db
      .select()
      .from(apiRequestLog)
      .orderBy(desc(apiRequestLog.createdAt))
      .limit(1);

    const [lastCompleted] = await db
      .select()
      .from(analysisJobs)
      .where(eq(analysisJobs.status, "COMPLETED"))
      .orderBy(desc(analysisJobs.completedAt))
      .limit(1);

    const lastUsage = lastCompleted
      ? (
          await db
            .select()
            .from(analysisUsage)
            .where(eq(analysisUsage.jobId, lastCompleted.id))
            .limit(1)
        )[0]
      : undefined;

    const recentLog = await db
      .select()
      .from(apiRequestLog)
      .orderBy(desc(apiRequestLog.createdAt))
      .limit(25);

    return NextResponse.json({
      apiConfigured: publicConfig.apiKeyConfigured,
      apiKeySource: publicConfig.apiKeySource,
      skillConfigured: Boolean(publicConfig.skillId),
      skillReachable,
      skillDetail,
      skillIdMasked: publicConfig.skillIdMasked,
      skillVersion: publicConfig.skillVersion,
      model: publicConfig.model,
      codeExecutionTool: publicConfig.codeExecutionTool,
      skillSourceDir: env.skillSourceDir,
      lastRequest: lastRequest
        ? { kind: lastRequest.kind, status: lastRequest.status, at: lastRequest.createdAt, durationMs: lastRequest.durationMs }
        : null,
      lastAnalysis: lastCompleted
        ? {
            id: lastCompleted.id,
            completedAt: lastCompleted.completedAt,
            durationMs: lastUsage?.durationMs ?? null,
            model: lastUsage?.model ?? lastCompleted.model,
            inputTokens: lastUsage?.inputTokens ?? null,
            outputTokens: lastUsage?.outputTokens ?? null,
            apiCalls: lastUsage?.apiCalls ?? null,
          }
        : null,
      recentLog: recentLog.map((r) => ({
        kind: r.kind,
        status: r.status,
        detail: r.detail,
        durationMs: r.durationMs,
        at: r.createdAt,
      })),
    });
  });
}
