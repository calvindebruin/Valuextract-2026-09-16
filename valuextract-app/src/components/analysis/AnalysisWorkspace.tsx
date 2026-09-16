"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "@/lib/format";

export type WorkspaceDocument = {
  id: string;
  category: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  periodLabel: string | null;
  uploadedAt: string;
};

type AnalysisSummary = {
  id: string;
  versionNo: number;
  createdAt: string;
  isArchived: boolean;
  opportunityCount: number;
};

type JobState = {
  id: string;
  status: "UPLOADED" | "QUEUED" | "PROCESSING" | "VALIDATING" | "COMPLETED" | "FAILED";
  stage: string | null;
  stages: string[];
  stageIndex: number;
  analysisId: string | null;
  error: { code: string | null; message: string } | null;
};

const CATEGORIES = [
  {
    key: "ANNUAL_FINANCIAL_STATEMENTS",
    label: "Annual Financial Statements",
    note: "Required or strongly recommended",
  },
  {
    key: "MANAGEMENT_ACCOUNTS",
    label: "Management Accounts",
    note: "Optional but recommended",
  },
  {
    key: "SUPPORTING_INFORMATION",
    label: "Supporting Information",
    note: "Optional — budgets, loan schedules, asset registers, production data",
  },
] as const;

const ACCEPT = ".pdf,.xlsx,.xls,.csv,.docx,.txt,.json";

export function AnalysisWorkspace({
  clientId,
  initialDocuments,
  initialJobId,
  configReady,
  configMessage,
  analyses,
}: {
  clientId: string;
  initialDocuments: WorkspaceDocument[];
  initialJobId: string | null;
  configReady: boolean;
  configMessage: string;
  analyses: AnalysisSummary[];
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [jobId, setJobId] = useState<string | null>(initialJobId);
  const [job, setJob] = useState<JobState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const submittedRef = useRef(false);

  const hasFinancials = useMemo(
    () =>
      documents.some(
        (d) =>
          d.category === "ANNUAL_FINANCIAL_STATEMENTS" ||
          d.category === "MANAGEMENT_ACCOUNTS",
      ),
    [documents],
  );

  const isRunning =
    job !== null && ["QUEUED", "PROCESSING", "VALIDATING"].includes(job.status);

  /* ------------------------------------------------------------ polling */
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (!response.ok) return;
        const state: JobState = await response.json();
        if (cancelled) return;
        setJob(state);
        if (state.status === "COMPLETED" && state.analysisId) {
          router.push(`/analyses/${state.analysisId}`);
        }
        if (state.status === "COMPLETED" || state.status === "FAILED") {
          submittedRef.current = false;
          clearInterval(timer);
        }
      } catch {
        // A transient poll failure is not an analysis failure.
      }
    }

    void poll();
    const timer = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [jobId, router]);

  /* ------------------------------------------------------------- upload */
  const upload = useCallback(
    async (category: string, files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);
      const form = new FormData();
      form.set("category", category);
      for (const file of Array.from(files)) form.append("files", file);

      const response = await fetch(`/api/clients/${clientId}/documents`, {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "The document could not be uploaded.");
        return;
      }
      setDocuments((current) => [...current, ...body.documents]);
    },
    [clientId],
  );

  const remove = useCallback(async (documentId: string) => {
    const response = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
    if (response.ok) {
      setDocuments((current) => current.filter((d) => d.id !== documentId));
    }
  }, []);

  /* ------------------------------------------------------------ analyse */
  const analyse = useCallback(
    async (supersedesAnalysisId?: string) => {
      // Guards against a double submission producing two identical runs.
      if (submittedRef.current || isRunning) return;
      submittedRef.current = true;
      setStarting(true);
      setError(null);
      try {
        const response = await fetch("/api/analyses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, supersedesAnalysisId }),
        });
        const body = await response.json();
        if (!response.ok) {
          setError(body?.error?.message ?? "The analysis could not be started.");
          submittedRef.current = false;
          return;
        }
        setJobId(body.jobId);
      } catch {
        setError("Could not reach the server. Please try again.");
        submittedRef.current = false;
      } finally {
        setStarting(false);
      }
    },
    [clientId, isRunning],
  );

  const latestAnalysis = analyses.find((a) => !a.isArchived) ?? analyses[0] ?? null;

  return (
    <div className="space-y-8">
      <section className="vx-card p-5">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold">Financial Information</h2>
          <p className="text-xs text-vx-muted">
            PDF, XLSX, XLS, CSV, DOCX or TXT · analysed server-side only
          </p>
        </div>

        <div className="mt-5 space-y-5">
          {CATEGORIES.map((category) => {
            const rows = documents.filter((d) => d.category === category.key);
            return (
              <div key={category.key} className="vx-card-2 p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium text-sm">{category.label}</p>
                    <p className="text-xs text-vx-muted mt-0.5">{category.note}</p>
                  </div>
                  <label className="cursor-pointer rounded-lg border border-vx-border px-3 py-1.5 text-xs font-medium hover:border-vx-gold hover:text-vx-gold">
                    Add files
                    <input
                      type="file"
                      multiple
                      accept={ACCEPT}
                      className="hidden"
                      onChange={(event) => {
                        void upload(category.key, event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {rows.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {rows.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center gap-3 rounded-lg bg-vx-bg/50 border border-vx-border-soft px-3 py-2 text-sm"
                      >
                        <span className="text-vx-positive shrink-0" aria-hidden>
                          ✓
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{doc.filename}</span>
                          <span className="block text-xs text-vx-muted">
                            {category.label} · {formatBytes(doc.sizeBytes)}
                          </span>
                        </span>
                        <a
                          href={`/api/documents/${doc.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-vx-muted hover:text-vx-text shrink-0"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => void remove(doc.id)}
                          disabled={isRunning}
                          className="text-xs text-vx-muted hover:text-[#ff8f9b] shrink-0 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-[#ff8f9b]">
            {error}
          </p>
        )}

        {!configReady && (
          <p className="mt-4 text-sm text-vx-gold">
            {configMessage} An administrator must complete the AI configuration before an
            analysis can run.
          </p>
        )}

        <div className="mt-6 flex items-center gap-4 flex-wrap">
          <button
            type="button"
            disabled={!hasFinancials || !configReady || isRunning || starting}
            onClick={() => void analyse()}
            className="rounded-lg bg-vx-gold px-5 py-2.5 text-sm font-semibold text-vx-navy hover:bg-vx-gold-light disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ✦ {isRunning ? "Analysis in progress…" : "Analyse with ValueXtract Agri"}
          </button>
          {!hasFinancials && (
            <span className="text-xs text-vx-muted">
              Add annual financial statements or management accounts to enable the analysis.
            </span>
          )}
        </div>
      </section>

      {job && isRunning && <ProgressPanel job={job} />}

      {job?.status === "FAILED" && (
        <section className="vx-card p-5 border-[#56202a]">
          <p className="font-semibold text-[#ff8f9b]">Analysis failed</p>
          <p className="mt-1 text-sm text-vx-muted">{job.error?.message}</p>
          <button
            type="button"
            onClick={() => void analyse()}
            className="mt-4 rounded-lg border border-vx-border px-4 py-2 text-sm hover:border-vx-gold"
          >
            Retry analysis
          </button>
        </section>
      )}

      {analyses.length > 0 && (
        <section className="vx-card p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-lg font-semibold">Analyses</h2>
            {latestAnalysis && (
              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/analyses/${latestAnalysis.id}`}
                  className="rounded-lg border border-vx-border px-3 py-1.5 text-xs hover:border-vx-gold"
                >
                  Open current report
                </Link>
                <button
                  type="button"
                  disabled={isRunning || !configReady}
                  onClick={() => void analyse(latestAnalysis.id)}
                  className="rounded-lg border border-vx-border px-3 py-1.5 text-xs hover:border-vx-gold disabled:opacity-40"
                >
                  Re-run with added information
                </button>
              </div>
            )}
          </div>
          <ul className="mt-4 divide-y divide-vx-border-soft">
            {analyses.map((analysis) => (
              <li key={analysis.id} className="py-3 flex items-center gap-4 text-sm">
                <Link
                  href={`/analyses/${analysis.id}`}
                  className="font-medium hover:text-vx-gold"
                >
                  Version {analysis.versionNo}
                </Link>
                <span className="text-vx-muted">
                  {formatDateTime(analysis.createdAt)}
                </span>
                <span className="text-vx-muted tabular">
                  {analysis.opportunityCount} opportunities
                </span>
                {analysis.isArchived && (
                  <span className="ml-auto text-xs text-vx-muted border border-vx-border rounded px-2 py-0.5">
                    Superseded
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Progress reflects the job's real stage. Stages ahead of the current one are
 * shown as pending, never as "in progress", and no percentage is invented.
 */
function ProgressPanel({ job }: { job: JobState }) {
  return (
    <section className="vx-card p-5">
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-vx-gold animate-pulse" />
        <h2 className="text-lg font-semibold">Analysing financial information</h2>
      </div>
      <ol className="mt-5 space-y-2.5 text-sm">
        {job.stages.map((stage, index) => {
          const state =
            job.stageIndex > index
              ? "done"
              : job.stageIndex === index
                ? "active"
                : "pending";
          return (
            <li key={stage} className="flex items-center gap-3">
              <span
                aria-hidden
                className={
                  state === "done"
                    ? "text-vx-positive"
                    : state === "active"
                      ? "text-vx-gold"
                      : "text-vx-muted"
                }
              >
                {state === "done" ? "✓" : state === "active" ? "●" : "○"}
              </span>
              <span className={state === "pending" ? "text-vx-muted" : ""}>{stage}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-5 text-xs text-vx-muted">
        A full agricultural analysis usually takes several minutes. You can leave this page —
        the analysis continues and the report appears under Analyses when it is ready.
      </p>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
