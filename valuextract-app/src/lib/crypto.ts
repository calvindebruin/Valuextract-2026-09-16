import "server-only";
import crypto from "node:crypto";
import { env } from "./env";

/**
 * AES-256-GCM envelope encryption for secrets held at rest in the application
 * database (currently the Anthropic API key). The key is derived from
 * APP_ENCRYPTION_KEY, which must come from the platform's secret store in
 * production.
 */

const VERSION = "v1";

function key(): Buffer {
  return crypto.createHash("sha256").update(env.encryptionKey, "utf8").digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Stored secret is not in the expected format.");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** "sk-ant-…abcd" — safe to show an administrator, never the full secret. */
export function maskSecret(secret: string | null | undefined): string | null {
  if (!secret) return null;
  if (secret.length <= 8) return "••••";
  return `${secret.slice(0, 7)}…${secret.slice(-4)}`;
}

export function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}
