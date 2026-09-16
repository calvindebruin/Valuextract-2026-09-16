import { describe, expect, it } from "vitest";
import { AnalysisError, classifyError, userFacingMessage } from "@/lib/errors";

describe("classifyError", () => {
  const cases: [unknown, string][] = [
    [{ status: 401, message: "unauthorized" }, "INVALID_API_KEY"],
    [{ status: 403, message: "forbidden" }, "INVALID_API_KEY"],
    [{ status: 404, message: "skill not found" }, "SKILL_NOT_FOUND"],
    [{ status: 429, message: "rate limit" }, "RATE_LIMITED"],
    [{ status: 413, message: "payload too large" }, "FILE_TOO_LARGE"],
    [{ name: "APIConnectionTimeoutError", message: "timed out" }, "TIMEOUT"],
    [{ message: "fetch failed" }, "NETWORK"],
    [{ status: 400, message: "code_execution_20250825 is not supported" }, "UNSUPPORTED_TOOL"],
    [new Error("something else"), "UNKNOWN"],
  ];

  for (const [input, expected] of cases) {
    it(`maps ${expected}`, () => {
      expect(classifyError(input).code).toBe(expected);
    });
  }

  it("passes an AnalysisError through unchanged", () => {
    const original = new AnalysisError("VALIDATION_FAILED", "detail");
    expect(classifyError(original)).toBe(original);
  });
});

describe("userFacingMessage", () => {
  it("reassures the user that documents are retained", () => {
    expect(userFacingMessage("TIMEOUT")).toContain("documents remain saved");
  });

  it("falls back to a generic message for an unknown code", () => {
    expect(userFacingMessage(null)).toContain("could not complete the analysis");
  });
});
