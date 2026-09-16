import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "../auth/guards";
import { redact } from "../errors";

/**
 * Uniform route-handler wrapper. Converts thrown errors to JSON without ever
 * leaking a stack trace, credential or document content to the caller.
 */
export function handleRoute<T>(fn: () => Promise<T>): Promise<NextResponse> {
  return fn()
    .then((body) =>
      body instanceof NextResponse ? body : NextResponse.json(body as object),
    )
    .catch((error: unknown) => {
      if (error instanceof HttpError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: error.status },
        );
      }
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_INPUT",
              message: "Some of the supplied values were not valid.",
              issues: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
            },
          },
          { status: 400 },
        );
      }
      // Anything unexpected: log server-side, return a generic message.
      console.error("[valuextract] unhandled route error:", redact(String(error)));
      return NextResponse.json(
        { error: { code: "SERVER_ERROR", message: "Something went wrong. Please try again." } },
        { status: 500 },
      );
    });
}

export function badRequest(code: string, message: string): HttpError {
  return new HttpError(400, code, message);
}

export function notFound(message = "Not found."): HttpError {
  return new HttpError(404, "NOT_FOUND", message);
}
