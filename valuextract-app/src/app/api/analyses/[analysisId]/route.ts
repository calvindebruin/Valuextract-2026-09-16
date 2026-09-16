import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { valuextractAnalyses } from "@/lib/db/schema";
import { requireApiUser } from "@/lib/auth/guards";
import { handleRoute, notFound } from "@/lib/api/handler";
import { loadAnalysis } from "@/lib/valuextract/persist";
import { bootstrap } from "@/lib/bootstrap";

export async function GET(
  _request: Request,
  context: { params: Promise<{ analysisId: string }> },
) {
  return handleRoute(async () => {
    await bootstrap();
    await requireApiUser();
    const { analysisId } = await context.params;
    const analysis = await loadAnalysis(analysisId);
    if (!analysis) throw notFound("Analysis not found.");
    return NextResponse.json({ analysis });
  });
}

const patchSchema = z.object({ isArchived: z.boolean() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ analysisId: string }> },
) {
  return handleRoute(async () => {
    await bootstrap();
    await requireApiUser();
    const { analysisId } = await context.params;
    const { isArchived } = patchSchema.parse(await request.json());

    const [existing] = await db
      .select({ id: valuextractAnalyses.id })
      .from(valuextractAnalyses)
      .where(eq(valuextractAnalyses.id, analysisId))
      .limit(1);
    if (!existing) throw notFound("Analysis not found.");

    await db
      .update(valuextractAnalyses)
      .set({ isArchived })
      .where(eq(valuextractAnalyses.id, analysisId));

    return NextResponse.json({ ok: true, isArchived });
  });
}
