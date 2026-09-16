import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/auth/guards";
import { handleRoute } from "@/lib/api/handler";
import {
  getAiConfig,
  getPublicAiConfig,
  saveAiConfig,
  CODE_EXECUTION_TOOL_CANDIDATES,
} from "@/lib/config/ai-config";
import { bootstrap } from "@/lib/bootstrap";

/**
 * The saved API key is never returned by this endpoint — only a mask. There is
 * no route in the application that emits the plaintext key.
 */
export async function GET() {
  return handleRoute(async () => {
    await bootstrap();
    await requireApiAdmin();
    return NextResponse.json({
      config: await getPublicAiConfig(),
      codeExecutionToolOptions: CODE_EXECUTION_TOOL_CANDIDATES,
    });
  });
}

const putSchema = z.object({
  apiKey: z.string().optional(),
  skillId: z.string().optional(),
  skillVersion: z.string().optional(),
  model: z.string().optional(),
  codeExecutionTool: z.string().optional(),
});

export async function PUT(request: Request) {
  return handleRoute(async () => {
    await bootstrap();
    const admin = await requireApiAdmin();
    const input = putSchema.parse(await request.json());

    // An unchanged key arrives as undefined from the form, so the stored
    // secret survives a settings save that only changes the model.
    await saveAiConfig(input, admin.id);

    const config = await getAiConfig();
    return NextResponse.json({ config: (await import("@/lib/config/ai-config")).toPublicConfig(config) });
  });
}
