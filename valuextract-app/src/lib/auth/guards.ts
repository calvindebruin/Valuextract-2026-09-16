import "server-only";
import { redirect } from "next/navigation";
import type { User } from "../db/schema";
import { getCurrentUser } from "./session";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** For server components. Redirects to the sign-in page when unauthenticated. */
export async function requirePageUser(returnTo?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`);
  }
  return user;
}

export async function requirePageAdmin(returnTo?: string): Promise<User> {
  const user = await requirePageUser(returnTo);
  if (user.role !== "ADMIN") redirect("/dashboard?error=forbidden");
  return user;
}

/** For route handlers. Throws HttpError, which `handleRoute` converts to JSON. */
export async function requireApiUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  return user;
}

export async function requireApiAdmin(): Promise<User> {
  const user = await requireApiUser();
  if (user.role !== "ADMIN") {
    throw new HttpError(403, "FORBIDDEN", "Administrator access is required.");
  }
  return user;
}
