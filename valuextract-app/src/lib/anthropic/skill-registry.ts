import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { env } from "../env";
import { AnalysisError, classifyError, redact } from "../errors";
import { createAnthropicClient, resolveAnthropic } from "./client";

/**
 * Registration and verification of the custom ValueXtract Agri Skill.
 *
 * The Skill is registered with Anthropic ONCE (or once per revision) and then
 * referenced by id on every analysis. Nothing here runs during an analysis.
 */

export type SkillSummary = {
  id: string;
  displayName: string;
  source: string;
  latestVersionId: string;
  createdAt: string;
  updatedAt: string;
};

export type SkillVerification =
  | {
      ok: true;
      skill: SkillSummary;
      /** Version ids newest-first, so an admin can pin one. */
      versions: { id: string; createdAt: string }[];
      resolvedVersion: string;
    }
  | { ok: false; code: string; message: string };

export async function listSkills(apiKey?: string): Promise<SkillSummary[]> {
  const client = apiKey
    ? createAnthropicClient(apiKey)
    : (await resolveAnthropic({ requireSkill: false })).client;

  const out: SkillSummary[] = [];
  for await (const skill of client.skills.list({ limit: 100 })) {
    out.push(toSummary(skill));
    if (out.length >= 200) break;
  }
  return out;
}

function toSummary(skill: {
  id: string;
  display_name: string;
  source: { type: string };
  latest_version_id: string;
  created_at: string;
  updated_at: string;
}): SkillSummary {
  return {
    id: skill.id,
    displayName: skill.display_name,
    source: skill.source?.type ?? "unknown",
    latestVersionId: skill.latest_version_id,
    createdAt: skill.created_at,
    updatedAt: skill.updated_at,
  };
}

/** Confirms the configured Skill exists and the requested version resolves. */
export async function verifySkill(input?: {
  apiKey?: string;
  skillId?: string;
  skillVersion?: string;
}): Promise<SkillVerification> {
  try {
    const resolved = input?.apiKey
      ? null
      : await resolveAnthropic({ requireSkill: false });
    const client = input?.apiKey
      ? createAnthropicClient(input.apiKey)
      : resolved!.client;
    const skillId = input?.skillId ?? resolved?.config.skillId ?? null;
    const requestedVersion = input?.skillVersion ?? resolved?.config.skillVersion ?? "latest";

    if (!skillId) {
      return { ok: false, code: "MISSING_SKILL_ID", message: "No Skill ID is configured." };
    }

    const skill = await client.skills.retrieve(skillId);

    const versions: { id: string; createdAt: string }[] = [];
    for await (const version of client.skills.versions.list(skillId, { limit: 50 })) {
      const v = version as unknown as { id: string; created_at: string };
      versions.push({ id: v.id, createdAt: v.created_at });
      if (versions.length >= 50) break;
    }

    let resolvedVersion = requestedVersion;
    if (requestedVersion === "latest") {
      resolvedVersion = skill.latest_version_id;
    } else if (!versions.some((v) => v.id === requestedVersion)) {
      return {
        ok: false,
        code: "SKILL_VERSION_NOT_FOUND",
        message: `Version ${requestedVersion} does not exist on this Skill.`,
      };
    }

    return { ok: true, skill: toSummary(skill), versions, resolvedVersion };
  } catch (error) {
    const classified = classifyError(error);
    const status = (error as { status?: number } | undefined)?.status;
    return {
      ok: false,
      code: status === 404 ? "SKILL_NOT_FOUND" : classified.code,
      message: redact(classified.detail ?? classified.message),
    };
  }
}

const SKILL_UPLOAD_MAX_BYTES = 30 * 1024 * 1024;

async function collectSkillFiles(dir: string): Promise<{ relative: string; bytes: Buffer }[]> {
  const root = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  const topLevel = path.basename(root);
  const files: { relative: string; bytes: Buffer }[] = [];
  let total = 0;

  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const bytes = await fs.readFile(full);
      total += bytes.byteLength;
      if (total > SKILL_UPLOAD_MAX_BYTES) {
        throw new AnalysisError("UPLOAD_FAILED", "Skill bundle exceeds the 30 MB limit.");
      }
      // Anthropic requires every file under one top-level directory whose root
      // holds SKILL.md, so relative paths are preserved as `<dir>/<path>`.
      files.push({
        relative: path.posix.join(topLevel, path.relative(root, full).split(path.sep).join("/")),
        bytes,
      });
    }
  }

  await walk(root);
  if (!files.some((f) => f.relative === `${topLevel}/SKILL.md`)) {
    throw new AnalysisError(
      "UPLOAD_FAILED",
      `SKILL.md was not found at the root of ${root}.`,
    );
  }
  return files;
}

export type RegistrationResult = {
  skillId: string;
  versionId: string;
  displayName: string;
  fileCount: number;
  mode: "created" | "new_version";
};

/**
 * Uploads the Skill directory to Anthropic. Called by an administrator from
 * the AI settings page or by `npm run skill:register` — never during an
 * analysis run.
 */
export async function registerSkill(options: {
  apiKey: string;
  directory?: string;
  displayName?: string;
  /** When supplied, a new version is added to that Skill instead of creating one. */
  existingSkillId?: string;
}): Promise<RegistrationResult> {
  const client: Anthropic = createAnthropicClient(options.apiKey);
  const directory = options.directory ?? env.skillSourceDir;
  const files = await collectSkillFiles(directory);

  const uploadables = await Promise.all(
    files.map((file) =>
      toFile(new Blob([new Uint8Array(file.bytes)]), file.relative, {
        type: "application/octet-stream",
      }),
    ),
  );

  if (options.existingSkillId) {
    const version = await client.skills.versions.create(options.existingSkillId, {
      files: uploadables,
    });
    const v = version as unknown as { id: string };
    return {
      skillId: options.existingSkillId,
      versionId: v.id,
      displayName: options.displayName ?? "ValueXtract - Agri",
      fileCount: files.length,
      mode: "new_version",
    };
  }

  const skill = await client.skills.create({
    files: uploadables,
    ...(options.displayName ? { display_name: options.displayName } : {}),
  });

  return {
    skillId: skill.id,
    versionId: skill.latest_version_id,
    displayName: skill.display_name,
    fileCount: files.length,
    mode: "created",
  };
}
