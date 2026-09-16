import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loadAnalysis } from "@/lib/valuextract/persist";
import { toReportView } from "@/lib/valuextract/view";
import { verifyPrintToken } from "@/lib/pdf/render";
import { ReportBody } from "@/components/report/ReportBody";
import { Wordmark } from "@/components/brand/Wordmark";
import { bootstrap } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

/**
 * Print layout consumed by the PDF renderer.
 *
 * The headless browser carries no session cookie, so access is granted by a
 * short-lived signed token scoped to one analysis. A signed-in user may also
 * open the page directly.
 */
export default async function PrintAnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ analysisId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  await bootstrap();
  const { analysisId } = await params;
  const { token } = await searchParams;

  const authorised =
    (token ? await verifyPrintToken(token, analysisId) : false) ||
    Boolean(await getCurrentUser());
  if (!authorised) notFound();

  const analysis = await loadAnalysis(analysisId);
  if (!analysis) notFound();

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Wordmark />
        <span className="text-xs text-vx-muted print-muted">
          Private and confidential
        </span>
      </div>
      <ReportBody report={toReportView(analysis)} printMode />
    </div>
  );
}
