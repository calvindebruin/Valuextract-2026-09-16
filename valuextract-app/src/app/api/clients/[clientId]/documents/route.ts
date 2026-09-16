import { NextResponse } from "next/server";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, documentCategories, financialDocuments } from "@/lib/db/schema";
import { requireApiUser } from "@/lib/auth/guards";
import { badRequest, handleRoute, notFound } from "@/lib/api/handler";
import { randomId, sha256 } from "@/lib/crypto";
import { putObject } from "@/lib/storage";
import { env } from "@/lib/env";
import { bootstrap } from "@/lib/bootstrap";

/** Extensions the analysis pipeline accepts. */
const ACCEPTED = new Map<string, string>([
  [".pdf", "application/pdf"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".xls", "application/vnd.ms-excel"],
  [".csv", "text/csv"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".txt", "text/plain"],
  [".json", "application/json"],
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  return handleRoute(async () => {
    await bootstrap();
    await requireApiUser();
    const { clientId } = await context.params;
    const rows = await db
      .select()
      .from(financialDocuments)
      .where(eq(financialDocuments.clientId, clientId))
      .orderBy(financialDocuments.uploadedAt);
    return NextResponse.json({ documents: rows.map(publicDocument) });
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  return handleRoute(async () => {
    await bootstrap();
    const user = await requireApiUser();
    const { clientId } = await context.params;

    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client) throw notFound("Client not found.");

    const form = await request.formData();
    const category = String(form.get("category") ?? "");
    if (!documentCategories.includes(category as (typeof documentCategories)[number])) {
      throw badRequest("INVALID_CATEGORY", "Choose a valid document category.");
    }
    const periodLabel = form.get("periodLabel");
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) throw badRequest("NO_FILES", "Select at least one document.");

    const created: ReturnType<typeof publicDocument>[] = [];

    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();
      if (!ACCEPTED.has(ext)) {
        throw badRequest(
          "UNSUPPORTED_DOCUMENT",
          `${file.name} is not a supported format. Upload PDF, XLSX, XLS, CSV, DOCX or TXT.`,
        );
      }
      if (file.size > env.maxUploadBytes) {
        throw badRequest(
          "FILE_TOO_LARGE",
          `${file.name} is larger than the ${Math.round(env.maxUploadBytes / 1024 / 1024)} MB limit.`,
        );
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      const id = randomId("doc");
      const storagePath = `clients/${clientId}/${id}${ext}`;
      await putObject(storagePath, bytes);

      await db.insert(financialDocuments).values({
        id,
        clientId,
        category: category as (typeof documentCategories)[number],
        filename: file.name,
        mimeType: file.type || ACCEPTED.get(ext) || "application/octet-stream",
        sizeBytes: bytes.byteLength,
        storagePath,
        checksum: sha256(bytes),
        periodLabel: typeof periodLabel === "string" && periodLabel ? periodLabel : null,
        uploadedBy: user.id,
      });

      const [row] = await db
        .select()
        .from(financialDocuments)
        .where(eq(financialDocuments.id, id))
        .limit(1);
      created.push(publicDocument(row));
    }

    return NextResponse.json({ documents: created }, { status: 201 });
  });
}

/** Storage paths and Anthropic file ids stay server-side. */
function publicDocument(row: typeof financialDocuments.$inferSelect) {
  return {
    id: row.id,
    clientId: row.clientId,
    category: row.category,
    filename: row.filename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    periodLabel: row.periodLabel,
    uploadedAt: row.uploadedAt,
  };
}
