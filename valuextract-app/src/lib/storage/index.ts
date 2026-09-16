import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../env";

/**
 * Local filesystem document store behind a narrow interface, so swapping in
 * S3/GCS later touches this file only. Paths are opaque keys; nothing derived
 * from a user-supplied filename is used as a directory component.
 */

function root(): string {
  const dir = env.storageDir;
  return path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
}

function resolveKey(key: string): string {
  const abs = path.join(root(), key);
  const normalised = path.normalize(abs);
  if (!normalised.startsWith(path.normalize(root()))) {
    throw new Error("Refusing to resolve a storage key outside the storage root.");
  }
  return normalised;
}

export async function putObject(key: string, data: Buffer): Promise<string> {
  const target = resolveKey(key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, data);
  return key;
}

export async function getObject(key: string): Promise<Buffer> {
  return fs.readFile(resolveKey(key));
}

export async function deleteObject(key: string): Promise<void> {
  await fs.rm(resolveKey(key), { force: true });
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await fs.access(resolveKey(key));
    return true;
  } catch {
    return false;
  }
}
