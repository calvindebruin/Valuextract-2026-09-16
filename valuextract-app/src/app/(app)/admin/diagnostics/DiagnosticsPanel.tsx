"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTime, formatTime } from "@/lib/format";

type Diagnostics = {
  apiConfigured: boolean;
  apiKeySource: string;
  skillConfigured: boolean;
  skillReachable: boolean | null;
  skillDetail: string | null;
  skillIdMasked: string | null;
  skillVersion: string;
  model: string;
  codeExecutionTool: string;
  skillSourceDir: string;
  lastRequest: { kind: string; status: string; at: string; durationMs: number | null } | null;
  lastAnalysis: {
    id: string;
    completedAt: string | null;
    durationMs: number | null;
    model: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    apiCalls: number | null;
  } | null;
  recentLog: {
    kind: string;
    status: string;
    detail: string | null;
    durationMs: number | null;
    at: string;
  }[];
};

export function DiagnosticsPanel() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);

  // Every state update happens after an await, so the effect never triggers a
  // synchronous cascading render.
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/diagnostics", { cache: "no-store" });
      if (response.ok) setData(await response.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <p className="text-sm text-vx-muted">Checking integration status…</p>;
  }
  if (!data) {
    return <p className="text-sm text-[#ff8f9b]">Diagnostics are unavailable.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="vx-card p-5">
        <dl className="grid gap-4 sm:grid-cols-2 text-sm">
          <Row label="API configured" value={data.apiConfigured ? "Yes" : "No"} ok={data.apiConfigured} />
          <Row label="API key source" value={data.apiKeySource} />
          <Row label="Skill configured" value={data.skillConfigured ? "Yes" : "No"} ok={data.skillConfigured} />
          <Row
            label="Skill reachable"
            value={
              data.skillReachable === null
                ? "Not checked"
                : data.skillReachable
                  ? "Yes"
                  : "No"
            }
            ok={data.skillReachable ?? undefined}
          />
          <Row label="Skill" value={data.skillDetail ?? "—"} />
          {/* Identifier only — the API secret is never sent to this page. */}
          <Row label="Skill ID" value={data.skillIdMasked ?? "—"} mono />
          <Row label="Skill version" value={data.skillVersion} mono />
          <Row label="Model" value={data.model} mono />
          <Row label="Code execution tool" value={data.codeExecutionTool} mono />
          <Row label="Skill source directory" value={data.skillSourceDir} mono />
        </dl>
        <button
          type="button"
          onClick={() => void refresh()}
          className="mt-5 rounded-lg border border-vx-border px-3 py-1.5 text-xs hover:border-vx-gold"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="vx-card p-5">
        <h2 className="vx-eyebrow mb-3">Last API request</h2>
        {data.lastRequest ? (
          <p className="text-sm">
            {data.lastRequest.kind} · {data.lastRequest.status} ·{" "}
            {data.lastRequest.durationMs ?? "—"} ms ·{" "}
            {formatDateTime(data.lastRequest.at)}
          </p>
        ) : (
          <p className="text-sm text-vx-muted">No requests recorded yet.</p>
        )}
      </div>

      <div className="vx-card p-5">
        <h2 className="vx-eyebrow mb-3">Last completed analysis</h2>
        {data.lastAnalysis ? (
          <dl className="grid gap-3 sm:grid-cols-2 text-sm">
            <Row label="Completed" value={
              formatDateTime(data.lastAnalysis.completedAt)
            } />
            <Row
              label="Duration"
              value={
                data.lastAnalysis.durationMs
                  ? `${(data.lastAnalysis.durationMs / 1000).toFixed(1)} s`
                  : "—"
              }
            />
            <Row label="Model" value={data.lastAnalysis.model ?? "—"} mono />
            <Row label="API calls" value={String(data.lastAnalysis.apiCalls ?? "—")} />
            <Row label="Input tokens" value={String(data.lastAnalysis.inputTokens ?? "—")} />
            <Row label="Output tokens" value={String(data.lastAnalysis.outputTokens ?? "—")} />
          </dl>
        ) : (
          <p className="text-sm text-vx-muted">No analysis has completed yet.</p>
        )}
      </div>

      <div className="vx-card p-5">
        <h2 className="vx-eyebrow mb-3">Recent activity</h2>
        <ul className="space-y-1.5 text-xs font-mono">
          {data.recentLog.map((entry, index) => (
            <li key={index} className="flex gap-3">
              <span className="text-vx-muted shrink-0">
                {formatTime(entry.at)}
              </span>
              <span
                className={
                  entry.status.startsWith("FAILED") ? "text-[#ff8f9b]" : "text-vx-positive"
                }
              >
                {entry.status}
              </span>
              <span className="text-vx-muted">{entry.kind}</span>
              {entry.detail && <span className="truncate">{entry.detail}</span>}
            </li>
          ))}
          {data.recentLog.length === 0 && (
            <li className="text-vx-muted font-sans">Nothing recorded yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  ok,
  mono,
}: {
  label: string;
  value: string;
  ok?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="vx-eyebrow">{label}</dt>
      <dd
        className={`mt-1 ${mono ? "font-mono text-xs break-all" : ""} ${
          ok === true ? "text-vx-positive" : ok === false ? "text-[#ff8f9b]" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
