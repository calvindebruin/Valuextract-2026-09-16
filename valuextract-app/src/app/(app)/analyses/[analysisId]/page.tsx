import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { analysisJobDocuments, financialDocuments, valuextractAnalyses } from "@/lib/db/schema";
import { requirePageUser } from "@/lib/auth/guards";
import { loadAnalysis } from "@/lib/valuextract/persist";
import { toReportView } from "@/lib/valuextract/view";
import { ReportBody } from "@/components/report/ReportBody";
import { ReportActions } from "@/components/report/ReportActions";

export const dynamic = "force-dynamic";

export default async function AnalysisReportPage({
  params,
}: {
  params: Promise<{ analysisId: string }>;
}) {
  await requirePageUser();
  const { analysisId } = await params;

  const analysis = await loadAnalysis(analysisId);
  if (!analysis) notFound();

  const report = toReportView(analysis);

  const sourceLinks = await db
    .select({
      id: financialDocuments.id,
      filename: financialDocuments.filename,
      category: financialDocuments.category,
    })
    .from(analysisJobDocuments)
    .innerJoin(
      financialDocuments,
      eq(analysisJobDocuments.documentId, financialDocuments.id),
    )
    .where(eq(analysisJobDocuments.jobId, analysis.jobId));

  const history = await db
    .select({
      id: valuextractAnalyses.id,
      versionNo: valuextractAnalyses.versionNo,
      createdAt: valuextractAnalyses.createdAt,
      isArchived: valuextractAnalyses.isArchived,
    })
    .from(valuextractAnalyses)
    .where(eq(valuextractAnalyses.clientId, analysis.clientId))
    .orderBy(desc(valuextractAnalyses.createdAt));

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <nav className="no-print text-xs text-vx-muted mb-6">
        <Link href="/clients" className="hover:text-vx-text">
          Clients
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/clients/${analysis.clientId}/valuextract-agri`}
          className="hover:text-vx-text"
        >
          {analysis.clientName}
        </Link>
        <span className="mx-2">/</span>
        <span>Version {analysis.versionNo}</span>
      </nav>

      {analysis.isArchived && (
        <div className="no-print vx-card p-4 mb-6 border-vx-gold/40 text-sm">
          This analysis has been superseded by a later run. It is kept for reference.
        </div>
      )}

      <ReportActions
        analysisId={analysis.id}
        clientId={analysis.clientId}
        isArchived={analysis.isArchived}
        sourceDocuments={sourceLinks}
        informationRequestCount={report.informationRequests.length}
        history={history}
      />

      <ReportBody report={report} />
    </div>
  );
}
