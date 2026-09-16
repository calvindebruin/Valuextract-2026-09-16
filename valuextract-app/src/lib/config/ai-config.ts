import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { appSettings } from "../db/schema";
import { decryptSecret, encryptSecret, maskSecret } from "../crypto";
import { env } from "../env";

/**
 * Resolved AI configuration.
 *
 * Precedence: values saved by an administrator (encrypted in the database)
 * override process environment values, which exist for local development and
 * for platforms whose secret store injects environment variables.
 *
 * `apiKey` never leaves the server: only `AiConfigPublic` is serialisable to
 * the browser and it carries a mask, not the secret.
 */

const KEYS = {
  apiKey: "ai.anthropic_api_key",
  skillId: "ai.skill_id",
  skillVersion: "ai.skill_version",
  model: "ai.model",
  codeExecutionTool: "ai.code_execution_tool",
} as const;

export const CODE_EXECUTION_TOOL_CANDIDATES = [
  "code_execution_20260521",
  "code_execution_20260120",
  "code_execution_20250825",
] as const;

export const DEFAULT_CODE_EXECUTION_TOOL = "code_execution_20250825";

export type AiConfig = {
  apiKey: string | null;
  apiKeySource: "database" | "environment" | "none";
  skillId: string | null;
  skillVersion: string;
  model: string;
  codeExecutionTool: string;
};

export type AiConfigPublic = {
  apiKeyConfigured: boolean;
  apiKeyMasked: string | null;
  apiKeySource: AiConfig["apiKeySource"];
  skillId: string | null;
  skillIdMasked: string | null;
  skillVersion: string;
  model: string;
  codeExecutionTool: string;
  status: "CONNECTED_PENDING_TEST" | "CONFIGURATION_REQUIRED";
};

async function readSettings(): Promise<Map<string, { value: string | null; enc: string | null }>> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, Object.values(KEYS)));
  return new Map(rows.map((r) => [r.key, { value: r.value, enc: r.valueEncrypted }]));
}

export async function getAiConfig(): Promise<AiConfig> {
  const settings = await readSettings();

  let apiKey: string | null = null;
  let apiKeySource: AiConfig["apiKeySource"] = "none";

  const storedKey = settings.get(KEYS.apiKey)?.enc;
  if (storedKey) {
    try {
      apiKey = decryptSecret(storedKey);
      apiKeySource = "database";
    } catch {
      // A key that cannot be decrypted (rotated APP_ENCRYPTION_KEY) is treated
      // as absent rather than crashing the request.
      apiKey = null;
    }
  }
  if (!apiKey && env.anthropicApiKey) {
    apiKey = env.anthropicApiKey;
    apiKeySource = "environment";
  }

  return {
    apiKey,
    apiKeySource,
    skillId: settings.get(KEYS.skillId)?.value || env.skillId || null,
    skillVersion: settings.get(KEYS.skillVersion)?.value || env.skillVersion,
    model: settings.get(KEYS.model)?.value || env.model,
    codeExecutionTool:
      settings.get(KEYS.codeExecutionTool)?.value ||
      env.codeExecutionTool ||
      DEFAULT_CODE_EXECUTION_TOOL,
  };
}

export function toPublicConfig(config: AiConfig): AiConfigPublic {
  const ready = Boolean(config.apiKey && config.skillId);
  return {
    apiKeyConfigured: Boolean(config.apiKey),
    apiKeyMasked: config.apiKey ? maskSecret(config.apiKey) : null,
    apiKeySource: config.apiKeySource,
    skillId: config.skillId,
    skillIdMasked: config.skillId
      ? `${config.skillId.slice(0, 12)}…${config.skillId.slice(-4)}`
      : null,
    skillVersion: config.skillVersion,
    model: config.model,
    codeExecutionTool: config.codeExecutionTool,
    status: ready ? "CONNECTED_PENDING_TEST" : "CONFIGURATION_REQUIRED",
  };
}

export async function getPublicAiConfig(): Promise<AiConfigPublic> {
  return toPublicConfig(await getAiConfig());
}

async function upsert(
  key: string,
  fields: { value?: string | null; valueEncrypted?: string | null },
  updatedBy: string,
): Promise<void> {
  const existing = await db
    .select({ key: appSettings.key })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);

  const patch = {
    ...fields,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  if (existing.length > 0) {
    await db.update(appSettings).set(patch).where(eq(appSettings.key, key));
  } else {
    await db.insert(appSettings).values({ key, ...patch });
  }
}

export type AiConfigUpdate = {
  /** Omit to leave the stored key untouched; pass "" to clear it. */
  apiKey?: string;
  skillId?: string;
  skillVersion?: string;
  model?: string;
  codeExecutionTool?: string;
};

export async function saveAiConfig(
  update: AiConfigUpdate,
  updatedBy: string,
): Promise<void> {
  if (update.apiKey !== undefined) {
    const trimmed = update.apiKey.trim();
    await upsert(
      KEYS.apiKey,
      { value: null, valueEncrypted: trimmed ? encryptSecret(trimmed) : null },
      updatedBy,
    );
  }
  if (update.skillId !== undefined) {
    await upsert(KEYS.skillId, { value: update.skillId.trim() || null }, updatedBy);
  }
  if (update.skillVersion !== undefined) {
    await upsert(
      KEYS.skillVersion,
      { value: update.skillVersion.trim() || "latest" },
      updatedBy,
    );
  }
  if (update.model !== undefined) {
    await upsert(KEYS.model, { value: update.model.trim() || null }, updatedBy);
  }
  if (update.codeExecutionTool !== undefined) {
    await upsert(
      KEYS.codeExecutionTool,
      { value: update.codeExecutionTool.trim() || null },
      updatedBy,
    );
  }
}
