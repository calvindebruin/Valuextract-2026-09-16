import "server-only";
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { financialDocuments } from "../db/schema";
import { getObject } from "../storage";
import { AnalysisError, classifyError, redact } from "../errors";
import { CODE_EXECUTION_TOOL_CANDIDATES } from "../config/ai-config";
import { buildAnalysisPrompt, type PromptClient, type PromptDocument } from "./prompt";

const MAX_TOKENS = 32000;
const MAX_TURNS = 24;

export type RunUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  serverToolRequests: number;
  apiCalls: number;
  durationMs: number;
};

export type AnalysisRunResult = {
  /** Unvalidated. Goes straight into the Zod contract, never to the database. */
  raw: unknown;
  rawText: string;
  source: "container_file" | "fenced_json";
  containerId: string | null;
  resolvedSkillVersion: string | null;
  codeExecutionTool: string;
  usage: RunUsage;
};

export type DocumentInput = {
  id: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  category: string;
  periodLabel: string | null;
  anthropicFileId: string | null;
};

/* ------------------------------------------------------------ file upload */

/**
 * Uploads each document to the Files API once and caches the returned id on
 * the document row, so re-running an analysis does not re-upload gigabytes.
 */
async function ensureUploaded(
  client: Anthropic,
  doc: DocumentInput,
): Promise<string> {
  if (doc.anthropicFileId) {
    try {
      await client.files.retrieveMetadata(doc.anthropicFileId);
      return doc.anthropicFileId;
    } catch {
      // Cached id is gone (expired or deleted) — fall through and re-upload.
    }
  }

  const bytes = await getObject(doc.storagePath);
  const uploadable = await toFile(new Blob([new Uint8Array(bytes)]), doc.filename, {
    type: doc.mimeType || "application/octet-stream",
  });

  let uploaded;
  try {
    uploaded = await client.files.upload({ file: uploadable });
  } catch (error) {
    const status = (error as { status?: number } | undefined)?.status;
    if (status === 413) throw new AnalysisError("FILE_TOO_LARGE", doc.filename);
    if (status === 400) throw new AnalysisError("UNSUPPORTED_DOCUMENT", doc.filename);
    throw new AnalysisError("UPLOAD_FAILED", redact((error as Error)?.message));
  }

  await db
    .update(financialDocuments)
    .set({
      anthropicFileId: uploaded.id,
      anthropicFileUploadedAt: new Date().toISOString(),
    })
    .where(eq(financialDocuments.id, doc.id));

  return uploaded.id;
}

/* ------------------------------------------------------- output extraction */

type FileRef = { fileId: string };

/** Deep-walks a response for any `file_id`, whatever block shape carries it. */
function collectFileIds(node: unknown, out: FileRef[] = [], seen = new Set<string>()): FileRef[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const item of node) collectFileIds(item, out, seen);
    return out;
  }
  const record = node as Record<string, unknown>;
  const fileId = record.file_id;
  if (typeof fileId === "string" && !seen.has(fileId)) {
    seen.add(fileId);
    out.push({ fileId });
  }
  for (const value of Object.values(record)) collectFileIds(value, out, seen);
  return out;
}

function extractFencedJson(text: string): string | null {
  const fences = [...text.matchAll(/```json\s*([\s\S]*?)```/gi)].map((m) => m[1].trim());
  for (let i = fences.length - 1; i >= 0; i -= 1) {
    if (fences[i].startsWith("{")) return fences[i];
  }
  // Last resort: the largest balanced object in the text.
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) return text.slice(first, last + 1);
  return null;
}

async function readContainerJson(
  client: Anthropic,
  fileIds: FileRef[],
): Promise<string | null> {
  // Newest ids last; prefer an exact valuextract-data.json match.
  const candidates: { id: string; filename: string }[] = [];
  for (const ref of fileIds) {
    try {
      const meta = await client.files.retrieveMetadata(ref.fileId);
      if (meta.filename?.toLowerCase().endsWith(".json")) {
        candidates.push({ id: ref.fileId, filename: meta.filename });
      }
    } catch {
      // A file that cannot be described is simply skipped.
    }
  }
  if (candidates.length === 0) return null;

  const preferred =
    candidates.find((c) => c.filename.toLowerCase() === "valuextract-data.json") ??
    candidates[candidates.length - 1];

  try {
    const response = await client.files.download(preferred.id);
    return await response.text();
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------------- the run */

export async function runValuextractAgri(options: {
  client: Anthropic;
  model: string;
  skillId: string;
  skillVersion: string;
  codeExecutionTool: string;
  promptClient: PromptClient;
  documents: DocumentInput[];
  priorInformationRequests?: string[];
  onStage?: (stage: string) => void | Promise<void>;
}): Promise<AnalysisRunResult> {
  const {
    client,
    model,
    skillId,
    skillVersion,
    promptClient,
    documents,
    priorInformationRequests,
    onStage,
  } = options;

  if (documents.length === 0) throw new AnalysisError("NO_DOCUMENTS");

  const startedAt = Date.now();
  const usage: RunUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    serverToolRequests: 0,
    apiCalls: 0,
    durationMs: 0,
  };

  await onStage?.("Transferring documents");

  const uploaded: { doc: DocumentInput; fileId: string }[] = [];
  for (const doc of documents) {
    uploaded.push({ doc, fileId: await ensureUploaded(client, doc) });
  }

  const promptDocuments: PromptDocument[] = documents.map((d) => ({
    filename: d.filename,
    category: d.category,
    periodLabel: d.periodLabel,
  }));

  const content: ContentBlockParam[] = [
    {
      type: "text",
      text: buildAnalysisPrompt(promptClient, promptDocuments, { priorInformationRequests }),
    },
  ];

  for (const { doc, fileId } of uploaded) {
    // Every document is placed in the container so the Skill's own scripts can
    // open it. PDFs are additionally attached as documents so the model reads
    // the statements directly rather than only through code.
    content.push({ type: "container_upload", file_id: fileId });
    if (doc.mimeType === "application/pdf") {
      content.push({
        type: "document",
        source: { type: "file", file_id: fileId },
        title: doc.filename,
      } as ContentBlockParam);
    }
  }

  const messages: MessageParam[] = [{ role: "user", content }];

  const toolOrder = [
    options.codeExecutionTool,
    ...CODE_EXECUTION_TOOL_CANDIDATES.filter((t) => t !== options.codeExecutionTool),
  ];

  let containerId: string | null = null;
  let resolvedSkillVersion: string | null = null;
  let usedTool = toolOrder[0];
  let finalResponse: Anthropic.Messages.Message | null = null;
  const allContent: unknown[] = [];

  await onStage?.("Analysing financial information");

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    let response: Anthropic.Messages.Message | null = null;
    let lastError: unknown = null;

    // The account may not have every code execution tool revision enabled.
    // On the first turn only, fall back through the known revisions rather
    // than failing the whole analysis on a tool-version mismatch.
    const attempts = turn === 0 ? toolOrder : [usedTool];
    for (const tool of attempts) {
      try {
        response = await client.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          container: {
            ...(containerId ? { id: containerId } : {}),
            skills: [{ type: "custom", skill_id: skillId, version: skillVersion }],
          },
          tools: [{ type: tool, name: "code_execution" } as Anthropic.Messages.ToolUnion],
          messages,
        });
        usedTool = tool;
        break;
      } catch (error) {
        lastError = error;
        const status = (error as { status?: number } | undefined)?.status;
        const message = (error as { message?: string } | undefined)?.message ?? "";
        const toolVersionProblem =
          status === 400 && /code_execution|tool|beta|not.*(support|available|enabl)/i.test(message);
        if (!toolVersionProblem) throw classifyError(error);
      }
    }

    if (!response) throw classifyError(lastError);

    usage.apiCalls += 1;
    usage.inputTokens += response.usage?.input_tokens ?? 0;
    usage.outputTokens += response.usage?.output_tokens ?? 0;
    usage.cacheReadTokens += response.usage?.cache_read_input_tokens ?? 0;
    usage.cacheCreationTokens += response.usage?.cache_creation_input_tokens ?? 0;
    usage.serverToolRequests +=
      (response.usage as { server_tool_use?: { web_search_requests?: number } } | undefined)
        ?.server_tool_use?.web_search_requests ?? 0;

    containerId = response.container?.id ?? containerId;
    resolvedSkillVersion =
      response.container?.skills?.find((s) => s.skill_id === skillId)?.version ??
      resolvedSkillVersion;

    allContent.push(response.content);
    finalResponse = response;

    if (response.stop_reason !== "pause_turn") break;

    // A paused turn is resumed by replaying the assistant content unchanged.
    messages.push({ role: "assistant", content: response.content });
    await onStage?.("Analysing financial information");
  }

  if (!finalResponse) throw new AnalysisError("INCOMPLETE_ANALYSIS");
  if (finalResponse.stop_reason === "pause_turn") {
    throw new AnalysisError("INCOMPLETE_ANALYSIS", "Turn limit reached before completion.");
  }
  if (finalResponse.stop_reason === "max_tokens") {
    throw new AnalysisError("INCOMPLETE_ANALYSIS", "Output token limit reached.");
  }
  if (finalResponse.stop_reason === "refusal") {
    throw new AnalysisError("INCOMPLETE_ANALYSIS", "The model declined to complete the analysis.");
  }

  await onStage?.("Reading structured results");

  const text = (finalResponse.content ?? [])
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  let rawText: string | null = null;
  let source: AnalysisRunResult["source"] = "container_file";

  const fileIds = collectFileIds(allContent);
  if (fileIds.length > 0) {
    rawText = await readContainerJson(client, fileIds);
  }
  if (!rawText) {
    rawText = extractFencedJson(text);
    source = "fenced_json";
  }
  if (!rawText) {
    throw new AnalysisError("MALFORMED_OUTPUT", "No JSON payload was produced.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new AnalysisError("MALFORMED_OUTPUT", redact((error as Error)?.message));
  }

  usage.durationMs = Date.now() - startedAt;

  return {
    raw: parsed,
    rawText,
    source,
    containerId,
    resolvedSkillVersion,
    codeExecutionTool: usedTool,
    usage,
  };
}
