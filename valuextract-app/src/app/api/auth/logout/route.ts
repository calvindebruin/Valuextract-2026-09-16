import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { handleRoute } from "@/lib/api/handler";

export async function POST() {
  return handleRoute(async () => {
    await destroySession();
    return NextResponse.json({ ok: true });
  });
}
