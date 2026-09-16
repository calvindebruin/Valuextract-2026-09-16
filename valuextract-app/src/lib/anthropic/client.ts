import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";
import { AnalysisError } from "../errors";
import { getAiConfig, type AiConfig } from "../config/ai-config";

/**
 * The Anthropic SDK is instantiated here and nowhere else, in a module marked
 * `server-only`. No client component can import this file, so the API key
 * cannot reach the browser bundle.
 */
export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    baseURL: env.anthropicBaseUrl,
    maxRetries: 2,
    timeout: 15 * 60 * 1000,
  });
}

export type ResolvedAi = { client: Anthropic; config: AiConfig };

/** Resolves configuration and returns a ready client, or throws a typed error. */
export async function resolveAnthropic(options: { requireSkill?: boolean } = {}): Promise<ResolvedAi> {
  const config = await getAiConfig();
  if (!config.apiKey) throw new AnalysisError("MISSING_API_KEY");
  if (options.requireSkill !== false && !config.skillId) {
    throw new AnalysisError("MISSING_SKILL_ID");
  }
  return { client: createAnthropicClient(config.apiKey), config };
}
