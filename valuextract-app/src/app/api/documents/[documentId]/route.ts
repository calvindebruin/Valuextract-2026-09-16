import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { financialDocuments } from "@/lib/db/schema";
import { requireApiUser } from "@/lib/auth/guards";
import { handleRoute, notFound } from "@/lib/api/handler";
import { deleteObject, getObject } from "@/lib/storage";
import { bootstrap } from "@/lib/bootstrap";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  return handleRoute(async () => {
    await bootstrap();
    await requireApiUser();
    const { documentId } = await context.params;

    const [doc] = await db
      .select()
      .from(financialDocuments)
      .where(eq(financialDocuments.id, documentId))
      .limit(1);
    if (!doc) throw notFound("Document not found.");

    const bytes = await getObject(doc.storagePath);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `inline; filename="${doc.filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  return handleRoute(async () => {
    await bootstrap();
    await requireApiUser();
    const { documentId } = await context.params;

    const [doc] = await db
      .select()
      .from(financialDocuments)
      .where(eq(financialDocuments.id, documentId))
      .limit(1);
    if (!doc) throw notFound("Document not found.");

    await deleteObject(doc.storagePath).catch(() => undefined);
    await db.delete(financialDocuments).where(eq(financialDocuments.id, documentId));
    return NextResponse.json({ ok: true });
  });
}
