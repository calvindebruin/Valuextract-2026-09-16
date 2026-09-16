import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, beforeAll } from "vitest";

process.env.APP_ENCRYPTION_KEY ??= "test-encryption-key-for-vitest-only";
process.env.SESSION_SECRET ??= "test-session-secret-for-vitest-only";

const SRC = path.join(process.cwd(), "src");

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

const allFiles = walk(SRC);
const clientFiles = allFiles.filter((file) => {
  const source = fs.readFileSync(file, "utf8");
  return /^\s*["']use client["']/m.test(source);
});

describe("API key exposure", () => {
  it("finds client components to check", () => {
    expect(clientFiles.length).toBeGreaterThan(0);
  });

  it("never imports the Anthropic SDK from a client component", () => {
    for (const file of clientFiles) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/@anthropic-ai\/sdk/);
    }
  });

  it("never imports server-only configuration or env modules from a client component", () => {
    for (const file of clientFiles) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/@\/lib\/(env|crypto|config\/ai-config|anthropic\/)/);
    }
  });

  it("never references the API key through a public build-time variable", () => {
    for (const file of allFiles) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/NEXT_PUBLIC_[A-Z_]*ANTHROPIC/);
      expect(source, file).not.toMatch(/NEXT_PUBLIC_[A-Z_]*API_KEY/);
    }
  });

  it("keeps the Anthropic SDK behind server-only modules", () => {
    const importers = allFiles.filter((file) =>
      /from ["']@anthropic-ai\/sdk/.test(fs.readFileSync(file, "utf8")),
    );
    expect(importers.length).toBeGreaterThan(0);
    for (const file of importers) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, file).toMatch(/^import "server-only";/m);
    }
  });

  it("never writes the API key into browser storage", () => {
    for (const file of allFiles) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/localStorage|sessionStorage/);
    }
  });
});

describe("secret handling", () => {
  it("round-trips an encrypted secret and never stores it in the clear", async () => {
    const { encryptSecret, decryptSecret, maskSecret } = await import("@/lib/crypto");
    const secret = "sk-ant-api03-abcdefghijklmnop";
    const sealed = encryptSecret(secret);
    expect(sealed).not.toContain(secret);
    expect(decryptSecret(sealed)).toBe(secret);
    expect(maskSecret(secret)).toBe("sk-ant-…mnop");
    expect(maskSecret(secret)).not.toContain("api03");
  });

  it("rejects a tampered ciphertext", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto");
    const sealed = encryptSecret("value");
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("redacts key-shaped strings before they reach a log", async () => {
    const { redact } = await import("@/lib/errors");
    expect(redact("failed with sk-ant-api03-secret-value")).toBe(
      "failed with sk-ant-***",
    );
  });
});

describe("public AI configuration", () => {
  beforeAll(() => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-api03-should-never-be-serialised";
  });

  it("emits a mask and no plaintext key", async () => {
    const { toPublicConfig } = await import("@/lib/config/ai-config");
    const publicConfig = toPublicConfig({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      apiKeySource: "environment",
      skillId: "skill_01ABCDEFGHIJKLMNOP",
      skillVersion: "latest",
      model: "claude-opus-5",
      codeExecutionTool: "code_execution_20250825",
    });
    const serialised = JSON.stringify(publicConfig);
    expect(serialised).not.toContain(process.env.ANTHROPIC_API_KEY!);
    expect(publicConfig.apiKeyConfigured).toBe(true);
    expect(publicConfig.apiKeyMasked).toMatch(/^sk-ant-…/);
  });
});
