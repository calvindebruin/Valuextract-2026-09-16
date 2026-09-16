"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";

type PublicConfig = {
  apiKeyConfigured: boolean;
  apiKeyMasked: string | null;
  apiKeySource: string;
  skillId: string | null;
  skillVersion: string;
  model: string;
  codeExecutionTool: string;
  status: "CONNECTED_PENDING_TEST" | "CONFIGURATION_REQUIRED";
};

type SkillCatalogueEntry = {
  id: string;
  displayName: string;
  source: string;
  latestVersionId: string;
  updatedAt: string;
};

export function AiSettingsForm({
  initial,
  toolOptions,
  skillSourceDir,
}: {
  initial: PublicConfig;
  toolOptions: string[];
  skillSourceDir: string;
}) {
  const router = useRouter();
  const [config, setConfig] = useState(initial);
  const [apiKey, setApiKey] = useState("");
  const [skillId, setSkillId] = useState(initial.skillId ?? "");
  const [versionMode, setVersionMode] = useState(
    initial.skillVersion === "latest" ? "latest" : "custom",
  );
  const [skillVersion, setSkillVersion] = useState(
    initial.skillVersion === "latest" ? "" : initial.skillVersion,
  );
  const [model, setModel] = useState(initial.model);
  const [tool, setTool] = useState(initial.codeExecutionTool);

  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<
    { tone: "ok" | "error" | "info"; text: string } | null
  >(null);
  const [catalogue, setCatalogue] = useState<SkillCatalogueEntry[] | null>(null);
  const [versions, setVersions] = useState<{ id: string; createdAt: string }[]>([]);

  const effectiveVersion = versionMode === "latest" ? "latest" : skillVersion.trim();

  async function save() {
    setBusy("save");
    setResult(null);
    try {
      const response = await fetch("/api/admin/ai-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // An untouched key field leaves the stored secret alone.
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          skillId,
          skillVersion: effectiveVersion || "latest",
          model,
          codeExecutionTool: tool,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setResult({ tone: "error", text: body?.error?.message ?? "Could not save." });
        return;
      }
      setConfig(body.config);
      setApiKey("");
      setResult({ tone: "ok", text: "Configuration saved." });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function testConnection() {
    setBusy("test");
    setResult(null);
    try {
      const response = await fetch("/api/admin/ai-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}), model }),
      });
      const body = await response.json();
      setResult(
        body.ok
          ? {
              tone: "ok",
              text: `Connected to ${body.model} in ${body.durationMs} ms.`,
            }
          : { tone: "error", text: `${body.message}${body.detail ? ` (${body.detail})` : ""}` },
      );
    } finally {
      setBusy(null);
    }
  }

  async function verifySkill() {
    setBusy("verify");
    setResult(null);
    try {
      const response = await fetch("/api/admin/ai-config/verify-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          skillId,
          skillVersion: effectiveVersion || "latest",
          includeCatalogue: true,
        }),
      });
      const body = await response.json();
      setCatalogue(body.catalogue ?? null);
      if (body.ok) {
        setVersions(body.versions ?? []);
        setResult({
          tone: "ok",
          text: `${body.skill.displayName} · ${body.skill.id} · source ${body.skill.source} · resolves to ${body.resolvedVersion}`,
        });
      } else {
        setVersions([]);
        setResult({ tone: "error", text: `${body.code}: ${body.message}` });
      }
    } finally {
      setBusy(null);
    }
  }

  async function registerSkill(existing?: string) {
    setBusy("register");
    setResult(null);
    try {
      const response = await fetch("/api/admin/ai-config/register-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          ...(existing ? { existingSkillId: existing } : {}),
        }),
      });
      const body = await response.json();
      if (!body.ok) {
        setResult({ tone: "error", text: `${body.code}: ${body.message}` });
        return;
      }
      setSkillId(body.skillId);
      setVersionMode("custom");
      setSkillVersion(body.versionId);
      setResult({
        tone: "ok",
        text: `Skill ${body.mode === "created" ? "registered" : "updated"} — ${body.skillId} (${body.fileCount} files, version ${body.versionId}). Saved to configuration.`,
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="vx-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <span
            className={`h-2 w-2 rounded-full ${
              config.status === "CONNECTED_PENDING_TEST" ? "bg-vx-positive" : "bg-vx-gold"
            }`}
          />
          <span className="text-sm font-medium">
            {config.status === "CONNECTED_PENDING_TEST" ? "Connected" : "Configuration required"}
          </span>
          {config.apiKeyConfigured && (
            <span className="text-xs text-vx-muted ml-2">
              key from {config.apiKeySource}
            </span>
          )}
        </div>

        <div className="space-y-5">
          <Field label="Anthropic API key" htmlFor="apiKey">
            <input
              id="apiKey"
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                config.apiKeyMasked
                  ? `${config.apiKeyMasked} — leave blank to keep`
                  : "sk-ant-…"
              }
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-vx-muted">
              Stored encrypted. The saved key is never sent back to this page.
            </p>
          </Field>

          <Field label="ValueXtract Agri Skill ID" htmlFor="skillId">
            <input
              id="skillId"
              value={skillId}
              onChange={(e) => setSkillId(e.target.value)}
              placeholder="skill_01…"
              className={`${inputClass} font-mono text-xs`}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Skill version" htmlFor="versionMode">
              <select
                id="versionMode"
                value={versionMode}
                onChange={(e) => setVersionMode(e.target.value)}
                className={inputClass}
              >
                <option value="latest">latest</option>
                <option value="custom">pinned version</option>
              </select>
              {versionMode === "custom" && (
                <>
                  <input
                    value={skillVersion}
                    onChange={(e) => setSkillVersion(e.target.value)}
                    placeholder="skver_01…"
                    className={`${inputClass} mt-2 font-mono text-xs`}
                    list="skill-versions"
                  />
                  <datalist id="skill-versions">
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {formatDateTime(v.createdAt)}
                      </option>
                    ))}
                  </datalist>
                  <p className="mt-1.5 text-xs text-vx-muted">
                    Pin a version in production so historical reports stay reproducible.
                  </p>
                </>
              )}
            </Field>

            <Field label="Claude model" htmlFor="model">
              <input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={`${inputClass} font-mono text-xs`}
              />
            </Field>
          </div>

          <Field label="Code execution tool" htmlFor="tool">
            <select
              id="tool"
              value={tool}
              onChange={(e) => setTool(e.target.value)}
              className={`${inputClass} font-mono text-xs`}
            >
              {toolOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-vx-muted">
              Agent Skills require the code execution tool. If the selected revision is not
              enabled on the account, the analysis falls back to another known revision.
            </p>
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void testConnection()}
            disabled={busy !== null}
            className={secondaryButton}
          >
            {busy === "test" ? "Testing…" : "Test connection"}
          </button>
          <button
            type="button"
            onClick={() => void verifySkill()}
            disabled={busy !== null}
            className={secondaryButton}
          >
            {busy === "verify" ? "Verifying…" : "Verify skill"}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy !== null}
            className="rounded-lg bg-vx-gold px-4 py-2 text-sm font-semibold text-vx-navy hover:bg-vx-gold-light disabled:opacity-50"
          >
            {busy === "save" ? "Saving…" : "Save configuration"}
          </button>
        </div>

        {result && (
          <p
            role="status"
            className={`mt-4 text-sm ${
              result.tone === "ok"
                ? "text-vx-positive"
                : result.tone === "error"
                  ? "text-[#ff8f9b]"
                  : "text-vx-muted"
            }`}
          >
            {result.text}
          </p>
        )}
      </div>

      <div className="vx-card p-5">
        <h2 className="text-sm font-semibold">Skill registration</h2>
        <p className="mt-1.5 text-sm text-vx-muted">
          Upload the bundled Skill directory (<code>{skillSourceDir}</code>, containing
          SKILL.md and its references) to the Anthropic workspace. Registration happens once
          — an analysis run never uploads the Skill.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void registerSkill()}
            disabled={busy !== null}
            className={secondaryButton}
          >
            {busy === "register" ? "Uploading…" : "Register as a new Skill"}
          </button>
          {skillId && (
            <button
              type="button"
              onClick={() => void registerSkill(skillId)}
              disabled={busy !== null}
              className={secondaryButton}
            >
              Publish new version of this Skill
            </button>
          )}
        </div>

        {catalogue && catalogue.length > 0 && (
          <div className="mt-5">
            <p className="vx-eyebrow mb-2">Custom skills in this workspace</p>
            <ul className="space-y-1.5 text-xs">
              {catalogue.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSkillId(entry.id)}
                    className="text-vx-gold hover:underline"
                  >
                    Use
                  </button>
                  <span className="font-medium">{entry.displayName}</span>
                  <span className="font-mono text-vx-muted">{entry.id}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg bg-vx-card-2 border border-vx-border px-3 py-2.5 text-sm outline-none focus:border-vx-gold";

const secondaryButton =
  "rounded-lg border border-vx-border px-4 py-2 text-sm hover:border-vx-gold hover:text-vx-gold disabled:opacity-50";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="vx-eyebrow block mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
