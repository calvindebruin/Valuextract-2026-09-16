import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { requireApiUser } from "@/lib/auth/guards";
import { handleRoute } from "@/lib/api/handler";
import { randomId } from "@/lib/crypto";
import { bootstrap } from "@/lib/bootstrap";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  subsector: z.string().max(120).optional().nullable(),
  financialYearEnd: z.string().max(60).optional().nullable(),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/, "Use a three-letter currency code such as ZAR.")
    .default("ZAR"),
  registrationNumber: z.string().max(60).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  isAgri: z.boolean().default(true),
});

export async function GET() {
  return handleRoute(async () => {
    await bootstrap();
    await requireApiUser();
    const rows = await db.select().from(clients).orderBy(desc(clients.createdAt));
    return NextResponse.json({ clients: rows });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    await bootstrap();
    const user = await requireApiUser();
    const input = createSchema.parse(await request.json());

    const id = randomId("cli");
    await db.insert(clients).values({
      id,
      name: input.name.trim(),
      industry: "Agriculture",
      subsector: input.subsector?.trim() || null,
      financialYearEnd: input.financialYearEnd?.trim() || null,
      currency: input.currency.toUpperCase(),
      registrationNumber: input.registrationNumber?.trim() || null,
      notes: input.notes?.trim() || null,
      isAgri: input.isAgri,
      createdBy: user.id,
    });

    return NextResponse.json({ id }, { status: 201 });
  });
}
