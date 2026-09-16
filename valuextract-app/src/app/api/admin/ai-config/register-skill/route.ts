import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/auth/guards";
import { handleRoute, badRequest } from "@/lib/api/handler";
import { registerSkill } from "@/lib/anthropic/skill-registry";
import { getAiConfig, saveAiConfig } from "@/lib/config/ai-config";
import { classifyError, redact } from "@/lib/errors";
import { env } from "@/lib/env";
import { bootstrap } from "@/lib/bootstrap";

const bodySchema = z.object({
  apiKey: z.string().optional(),
  /** Supply to publish a new version of an existing Skill instead of creating one. */
  existingSkillId: z.string().optional(),
  displayName: z.string().optional(),
  directory: z.string().optional(),
});

/**
 * Registers the ValueXtract Agri Skill bundle with Anthropic and stores the
 * returned Skill ID. Deliberately an explicit administrator action — an
 * analysis run never uploads the Skill.
 */
export async function POST(request: Request) {
  return handleRoute(async () => {
    await bootstrap();
    const admin = await requireApiAdmin();
    const input = bodySchema.parse(await request.json().catch(() => ({})));

    const config = await getAiConfig();
    const apiKey = input.apiKey?.trim() || config.apiKey;
    if (!apiKey) throw badRequest("MISSING_API_KEY", "Save an Anthropic API key first.");

    try {
      const result = await registerSkill({
        apiKey,
        directory: input.directory || env.skillSourceDir,
        displayName: input.displayName || "ValueXtract - Agri",
        existingSkillId: input.existingSkillId?.trim() || undefined,
      });

      await saveAiConfig(
        { skillId: result.skillId, skillVersion: result.versionId },
        admin.id,
      );

      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      const classified = classifyError(error);
      return NextResponse.json({
        ok: false,
        code: classified.code,
        message: classified.message,
        detail: redact(classified.detail),
      });
    }
  });
}
