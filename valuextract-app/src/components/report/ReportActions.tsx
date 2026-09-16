"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";

export function ReportActions({
  analysisId,
  clientId,
  isArchived,
  sourceDocuments,
  informationRequestCount,
  history,
}: {
  analysisId: string;
  clientId: string;
  isArchived: boolean;
  sourceDocuments: { id: string; filename: string; category: string }[];
  informationRequestCount: number;
  history: { id: string; versionNo: number; createdAt: string; isArchived: boolean }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function exportPdf() {
    setBusy("pdf");
    setMessage(null);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/pdf`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setMessage(
          body?.error?.message ??
            "The PDF could not be generated. Use your browser's print dialogue instead.",
        );
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `valuextract-agri-${analysisId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  async function toggleArchive() {
    setBusy("archive");
    try {
      await fetch(`/api/analyses/${analysisId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !isArchived }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="no-print mb-8">
      <div className="flex flex-wrap gap-2">
        <Action onClick={() => void exportPdf()} busy={busy === "pdf"}>
          Export PDF
        </Action>
        <LinkAction href={`/clients/${clientId}/valuextract-agri`}>
          Re-run analysis
        </LinkAction>
        <LinkAction href={`/clients/${clientId}/valuextract-agri`}>
          Upload additional information
        </LinkAction>
        <Action onClick={() => setShowSources((v) => !v)}>
          View source documents ({sourceDocuments.length})
        </Action>
        <Action
          onClick={() => {
            document
              .getElementById("information-requests")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          View missing information ({informationRequestCount})
        </Action>
        <Action onClick={() => void toggleArchive()} busy={busy === "archive"}>
          {isArchived ? "Restore analysis" : "Archive analysis"}
        </Action>
        {history.length > 1 && (
          <Action onClick={() => setShowHistory((v) => !v)}>
            Previous analyses ({history.length - 1})
          </Action>
        )}
      </div>

      {message && (
        <p role="alert" className="mt-3 text-sm text-vx-gold">
          {message}
        </p>
      )}

      {showSources && (
        <ul className="mt-4 vx-card p-4 space-y-2 text-sm">
          {sourceDocuments.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3">
              <a
                href={`/api/documents/${doc.id}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-vx-gold"
              >
                {doc.filename}
              </a>
              <span className="text-xs text-vx-muted">
                {doc.category.replaceAll("_", " ").toLowerCase()}
              </span>
            </li>
          ))}
          {sourceDocuments.length === 0 && (
            <li className="text-vx-muted">No source documents are linked to this run.</li>
          )}
        </ul>
      )}

      {showHistory && (
        <ul className="mt-4 vx-card p-4 space-y-2 text-sm">
          {history.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              <Link href={`/analyses/${item.id}`} className="hover:text-vx-gold">
                Version {item.versionNo}
              </Link>
              <span className="text-xs text-vx-muted">
                {formatDateTime(item.createdAt)}
              </span>
              {item.id === analysisId && (
                <span className="text-xs text-vx-gold">current view</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Action({
  children,
  onClick,
  busy,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-lg border border-vx-border px-3 py-1.5 text-xs hover:border-vx-gold hover:text-vx-gold disabled:opacity-50"
    >
      {busy ? "Working…" : children}
    </button>
  );
}

function LinkAction({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-vx-border px-3 py-1.5 text-xs hover:border-vx-gold hover:text-vx-gold"
    >
      {children}
    </Link>
  );
}
