/**
 * Development seed: an administrator, an analyst and a sample agricultural
 * client. No real client documents are committed to this repository.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });
import { runMigrations } from "../src/lib/db/migrate";
import { db } from "../src/lib/db";
import { clients, users } from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/auth/password";
import { randomId } from "../src/lib/crypto";

async function main() {
  runMigrations();

  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length === 0) {
    await db.insert(users).values([
      {
        id: randomId("usr"),
        email: "admin@valuextract.io",
        name: "ValueXtract Administrator",
        role: "ADMIN",
        passwordHash: hashPassword(process.env.ADMIN_PASSWORD ?? "ChangeMe!2026"),
      },
      {
        id: randomId("usr"),
        email: "analyst@valuextract.io",
        name: "ValueXtract Analyst",
        role: "USER",
        passwordHash: hashPassword(process.env.ANALYST_PASSWORD ?? "ChangeMe!2026"),
      },
    ]);
    console.log("Seeded users: admin@valuextract.io, analyst@valuextract.io");
  }

  const existingClients = await db.select({ id: clients.id }).from(clients).limit(1);
  if (existingClients.length === 0) {
    await db.insert(clients).values({
      id: randomId("cli"),
      name: "JJ Gouws Boerdery (Pty) Ltd",
      industry: "Agriculture",
      subsector: "Deciduous fruit",
      financialYearEnd: "28 February 2026",
      currency: "ZAR",
    });
    console.log("Seeded sample client: JJ Gouws Boerdery (Pty) Ltd");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
