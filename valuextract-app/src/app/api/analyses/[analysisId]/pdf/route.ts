import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { handleRoute, notFound } from "@/lib/api/handler";
import { loadAnalysis } from "@/lib/valuextract/persist";
import { createPrintToken, renderPdf, PdfUnavailableError } from "@/lib/pdf/render";
import { bootstrap } from "@/lib/bootstrap";

export const maxDuration = 120;

export async function GET(
  request: Request,
  context: { params: Promise<{ analysisId: string }> },
) {
  return handleRoute(async () => {
    await bootstrap();
    await requireApiUser();
    const { analysisId } = await context.params;

    const analysis = await loadAnalysis(analysisId);
    if (!analysis) throw notFound("Analysis not found.");

    const origin = process.env.APP_ORIGIN || new URL(request.url).origin;
    const token = await createPrintToken(analysisId);
    const url = `${origin}/print/analyses/${analysisId}?token=${encodeURIComponent(token)}`;

    try {
      const pdf = await renderPdf(url);
      const safeName = `${analysis.clientName} ValueXtract Agri v${analysis.versionNo}`
        .replace(/[^\w\s.-]/g, "")
        .trim();
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch (error) {
      if (error instanceof PdfUnavailableError) {
        return NextResponse.json(
          {
            error: {
              code: "PDF_UNAVAILABLE",
              message:
                "PDF rendering is not available on this server yet. Use the browser's print dialogue in the meantime.",
            },
          },
          { status: 503 },
        );
      }
      throw error;
    }
  });
}
