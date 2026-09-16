import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, publicUser } from "@/lib/auth/session";
import { handleRoute } from "@/lib/api/handler";
import { HttpError } from "@/lib/auth/guards";
import { bootstrap } from "@/lib/bootstrap";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    await bootstrap();
    const { email, password } = bodySchema.parse(await request.json());

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    // Same message either way: never reveal whether an address exists.
    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Email address or password is incorrect.");
    }

    await createSession(user.id);
    return NextResponse.json({ user: publicUser(user) });
  });
}
