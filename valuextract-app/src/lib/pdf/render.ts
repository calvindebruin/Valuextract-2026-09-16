import "server-only";
import fs from "node:fs";
import path from "node:path";
import { SignJWT, jwtVerify } from "jose";
import { chromium, type Browser } from "playwright-core";
import { env } from "../env";

/**
 * PDF export renders the application's own print layout — the same structured
 * data the interactive report uses. Claude is not called again to produce a
 * PDF.
 */

const TOKEN_TTL_SECONDS = 120;

function secret(): Uint8Array {
  return new TextEncoder().encode(`${env.sessionSecret}:print`);
}

export async function createPrintToken(analysisId: string): Promise<string> {
  return new SignJWT({ analysisId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyPrintToken(
  token: string,
  analysisId: string,
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.analysisId === analysisId;
  } catch {
    return false;
  }
}

/** Finds a Chromium binary: explicit path, then common install locations. */
function resolveExecutable(): string | undefined {
  const explicit = env.chromiumExecutablePath;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const candidates = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/opt/google/chrome/chrome",
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  // Playwright's own download directory, when one is present.
  const pwRoot = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pwRoot && fs.existsSync(pwRoot)) {
    for (const entry of fs.readdirSync(pwRoot)) {
      if (!entry.startsWith("chromium")) continue;
      const guess = path.join(pwRoot, entry, "chrome-linux", "chrome");
      if (fs.existsSync(guess)) return guess;
    }
  }
  return undefined;
}

export class PdfUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfUnavailableError";
  }
}

export async function renderPdf(url: string): Promise<Buffer> {
  const executablePath = resolveExecutable();
  if (!executablePath) {
    throw new PdfUnavailableError(
      "No Chromium binary was found. Set CHROMIUM_EXECUTABLE_PATH or install a Chromium build.",
    );
  }

  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      executablePath,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    // The print layout expands every disclosure before printing.
    await page.emulateMedia({ media: "print" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "16mm", left: "12mm", right: "12mm" },
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#6b7280;padding:0 12mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif;">
          <span>ValueXtract Agri — private and confidential</span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`,
    });
    return Buffer.from(pdf);
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
