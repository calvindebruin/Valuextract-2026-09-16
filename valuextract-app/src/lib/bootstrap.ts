import "server-only";
import { runMigrations } from "./db/migrate";
import { db } from "./db";
import { users } from "./db/schema";
import { hashPassword } from "./auth/password";
import { randomId } from "./crypto";

let done = false;

/**
 * Applied once per server process: schema migrations, plus a first
 * administrator when the user table is empty so a fresh install is reachable.
 */
export async function bootstrap(): Promise<void> {
  if (done) return;
  runMigrations();

  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length === 0) {
    const email = (process.env.ADMIN_EMAIL ?? "admin@valuextract.io").toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? "ChangeMe!2026";
    await db.insert(users).values({
      id: randomId("usr"),
      email,
      name: process.env.ADMIN_NAME ?? "ValueXtract Administrator",
      role: "ADMIN",
      passwordHash: hashPassword(password),
    });
    console.warn(
      `[valuextract] Created initial administrator ${email}. Change this password immediately.`,
    );
  }

  done = true;
}
