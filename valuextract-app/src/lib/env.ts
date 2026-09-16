import "server-only";

/**
 * Server-only environment access.
 *
 * Nothing in here may ever be imported from a client component. The
 * `server-only` import above turns any such import into a build error, which is
 * the primary guard against leaking the Anthropic API key to the browser.
 */

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return value;
}

export const env = {
  get databaseUrl(): string {
    return process.env.DATABASE_URL ?? "file:./data/valuextract.db";
  },
  get storageDir(): string {
    return process.env.STORAGE_DIR ?? "./data/uploads";
  },
  get sessionSecret(): string {
    return required(
      "SESSION_SECRET",
      process.env.NODE_ENV === "production" ? undefined : "dev-only-session-secret-change-me-please",
    );
  },
  get encryptionKey(): string {
    return required(
      "APP_ENCRYPTION_KEY",
      process.env.NODE_ENV === "production" ? undefined : "dev-only-encryption-key-change-me-please",
    );
  },
  /** Development fallback only. Production should use the admin AI settings. */
  get anthropicApiKey(): string | undefined {
    return process.env.ANTHROPIC_API_KEY || undefined;
  },
  get anthropicBaseUrl(): string | undefined {
    return process.env.ANTHROPIC_BASE_URL || undefined;
  },
  get skillId(): string | undefined {
    return process.env.VALUEXTRACT_AGRI_SKILL_ID || undefined;
  },
  get skillVersion(): string {
    return process.env.VALUEXTRACT_AGRI_SKILL_VERSION || "latest";
  },
  get model(): string {
    return process.env.ANTHROPIC_MODEL || "claude-opus-5";
  },
  get codeExecutionTool(): string | undefined {
    return process.env.ANTHROPIC_CODE_EXECUTION_TOOL || undefined;
  },
  get chromiumExecutablePath(): string | undefined {
    return process.env.CHROMIUM_EXECUTABLE_PATH || undefined;
  },
  get maxUploadBytes(): number {
    return Number(process.env.MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024);
  },
  get skillSourceDir(): string {
    return process.env.VALUEXTRACT_AGRI_SKILL_DIR ?? "./skill/valuextract-agri";
  },
};
