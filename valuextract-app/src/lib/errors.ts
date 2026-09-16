/**
 * Analysis failure taxonomy.
 *
 * Every failure reaching a user is mapped to one of these codes so the UI can
 * show plain, reassuring language while the technical detail stays in the
 * admin log. Document contents and credentials never appear in either.
 */
export const ANALYSIS_ERRORS = {
  MISSING_API_KEY: "The Anthropic API key has not been configured yet.",
  INVALID_API_KEY: "The configured Anthropic API key was rejected.",
  MISSING_SKILL_ID: "The ValueXtract Agri Skill has not been configured yet.",
  SKILL_NOT_FOUND: "The configured ValueXtract Agri Skill could not be found in the Anthropic workspace.",
  SKILL_VERSION_NOT_FOUND: "The configured Skill version could not be found.",
  UNSUPPORTED_TOOL: "The configured model or code execution tool version is not available on this account.",
  NO_DOCUMENTS: "No financial information has been supplied for this analysis.",
  FILE_TOO_LARGE: "One of the documents is larger than the upload limit.",
  UNSUPPORTED_DOCUMENT: "One of the documents is in a format that cannot be analysed.",
  UPLOAD_FAILED: "The documents could not be transferred for analysis.",
  TIMEOUT: "The analysis did not complete within the allowed time.",
  RATE_LIMITED: "The analysis service is busy. Please retry shortly.",
  NETWORK: "The analysis service could not be reached.",
  CODE_EXECUTION_FAILED: "The analysis environment failed while processing the documents.",
  MALFORMED_OUTPUT: "The analysis returned data that could not be read.",
  VALIDATION_FAILED: "The analysis returned incomplete data and was not saved.",
  INCOMPLETE_ANALYSIS: "The analysis stopped before it finished.",
  UNKNOWN: "ValueXtract could not complete the analysis.",
} as const;

export type AnalysisErrorCode = keyof typeof ANALYSIS_ERRORS;

export class AnalysisError extends Error {
  constructor(
    readonly code: AnalysisErrorCode,
    /** Technical context for the admin log only. Never shown to end users. */
    readonly detail?: string,
  ) {
    super(ANALYSIS_ERRORS[code]);
    this.name = "AnalysisError";
  }
}

const USER_SUFFIX = "Your documents remain saved. You can retry the analysis.";

export function userFacingMessage(code: AnalysisErrorCode | null | undefined): string {
  const base = code ? ANALYSIS_ERRORS[code] : ANALYSIS_ERRORS.UNKNOWN;
  return `${base} ${USER_SUFFIX}`;
}

/** Classifies an unknown thrown value into the taxonomy above. */
export function classifyError(error: unknown): AnalysisError {
  if (error instanceof AnalysisError) return error;

  const anyError = error as { status?: number; message?: string; name?: string } | undefined;
  const status = anyError?.status;
  const message = anyError?.message ?? String(error);

  if (status === 401 || status === 403) return new AnalysisError("INVALID_API_KEY", message);
  if (status === 404 && /skill/i.test(message)) return new AnalysisError("SKILL_NOT_FOUND", message);
  if (status === 429) return new AnalysisError("RATE_LIMITED", message);
  if (status === 413) return new AnalysisError("FILE_TOO_LARGE", message);
  if (status === 408 || anyError?.name === "APIConnectionTimeoutError") {
    return new AnalysisError("TIMEOUT", message);
  }
  if (anyError?.name === "APIConnectionError" || /fetch failed|ENOTFOUND|ECONNREFUSED/i.test(message)) {
    return new AnalysisError("NETWORK", message);
  }
  if (status === 400 && /code_execution|tool.*type|not supported/i.test(message)) {
    return new AnalysisError("UNSUPPORTED_TOOL", message);
  }
  return new AnalysisError("UNKNOWN", message);
}

/** Strips anything secret-shaped before a message is written to the log. */
export function redact(text: string | undefined | null): string {
  if (!text) return "";
  return text
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-***")
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1***")
    .slice(0, 4000);
}
