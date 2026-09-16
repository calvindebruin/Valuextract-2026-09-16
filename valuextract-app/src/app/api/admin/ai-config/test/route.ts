import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/auth/guards";
import { handleRoute } from "@/lib/api/handler";
import { createAnthropicClient } from "@/lib/anthropic/client";
import { getAiConfig } from "@/lib/config/ai-config";
import { classifyError, redact } from "@/lib/errors";
import { bootstrap } from "@/lib/bootstrap";
import { db } from "@/lib/db";
import { apiRequestLog } from "@/lib/db/schema";
import { randomId } from "@/lib/crypto";

const bodySchema = z.object({
  /** Optional: test a key the admin has typed but not yet saved. */
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    await bootstrap();
    await requireApiAdmin();

    const body = await request.json().catch(() => ({}));
    const input = bodySchema.parse(body);
    const config = await getAiConfig();
    const apiKey = input.apiKey?.trim() || config.apiKey;

    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        code: "MISSING_API_KEY",
        message: "No Anthropic API key is configured.",
      });
    }

    const started = Date.now();
    try {
      const client = createAnthropicClient(apiKey);
      const model = input.model?.trim() || config.model;
      // A minimal call: proves the credential works and the model is reachable
      // without spending meaningful tokens.
      const response = await client.messages.create({
        model,
        max_tokens: 16,
        messages: [{ role: "user", content: "Reply with the single word: ready" }],
      });
      const durationMs = Date.now() - started;

      await db.insert(apiRequestLog).values({
        id: randomId("log"),
        kind: "test_connection",
        status: "OK",
        detail: `model ${model}`,
        durationMs,
      });

      return NextResponse.json({
        ok: true,
        model: response.model,
        durationMs,
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      });
    } catch (error) {
      const classified = classifyError(error);
      const durationMs = Date.now() - started;
      await db.insert(apiRequestLog).values({
        id: randomId("log"),
        kind: "test_connection",
        status: `FAILED:${classified.code}`,
        detail: redact(classified.detail),
        durationMs,
      });
      return NextResponse.json({
        ok: false,
        code: classified.code,
        message: classified.message,
        detail: redact(classified.detail),
      });
    }
  });
}
