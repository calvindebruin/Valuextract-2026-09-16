import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/auth/guards";
import { handleRoute } from "@/lib/api/handler";
import { listSkills, verifySkill } from "@/lib/anthropic/skill-registry";
import { getAiConfig } from "@/lib/config/ai-config";
import { redact } from "@/lib/errors";
import { bootstrap } from "@/lib/bootstrap";

const bodySchema = z.object({
  apiKey: z.string().optional(),
  skillId: z.string().optional(),
  skillVersion: z.string().optional(),
  /** Also return the workspace's custom Skills, to help find the right id. */
  includeCatalogue: z.boolean().optional(),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    await bootstrap();
    await requireApiAdmin();

    const input = bodySchema.parse(await request.json().catch(() => ({})));
    const config = await getAiConfig();
    const apiKey = input.apiKey?.trim() || config.apiKey || undefined;

    const result = await verifySkill({
      apiKey,
      skillId: input.skillId?.trim() || config.skillId || undefined,
      skillVersion: input.skillVersion?.trim() || config.skillVersion,
    });

    let catalogue: Awaited<ReturnType<typeof listSkills>> | undefined;
    if (input.includeCatalogue && apiKey) {
      try {
        catalogue = (await listSkills(apiKey)).filter((s) => s.source === "custom");
      } catch (error) {
        catalogue = undefined;
        console.warn("[valuextract] skill catalogue unavailable:", redact(String(error)));
      }
    }

    return NextResponse.json({ ...result, catalogue });
  });
}
