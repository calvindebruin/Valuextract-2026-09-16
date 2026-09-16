import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, type User } from "../db/schema";
import { env } from "../env";

const COOKIE = "vx_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Returns the signed-in user, or null. Never throws on a bad cookie. */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = payload.sub;
    if (typeof userId !== "string") return null;
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || !user.isActive) return null;
    return user;
  } catch {
    return null;
  }
}

/** Public shape of a user. Never includes the password hash. */
export function publicUser(user: User) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}
