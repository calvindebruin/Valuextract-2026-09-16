import { describe, expect, it } from "vitest";
import { formatMoney, formatRoi } from "@/lib/valuextract/calculations";
import { formatDate, formatDateTime } from "@/lib/format";

describe("formatMoney", () => {
  it("formats full amounts with grouped thousands", () => {
    expect(formatMoney(7_500_000, "ZAR")).toBe("R7 500 000");
    expect(formatMoney(320_000, "ZAR")).toBe("R320 000");
    expect(formatMoney(950, "ZAR")).toBe("R950");
  });

  it("formats compact amounts in advisory shorthand", () => {
    expect(formatMoney(3_400_000, "ZAR", { compact: true })).toBe("R3.4m");
    expect(formatMoney(11_900_000, "ZAR", { compact: true })).toBe("R11.9m");
    expect(formatMoney(320_000, "ZAR", { compact: true })).toBe("R320k");
    expect(formatMoney(1_250_000_000, "ZAR", { compact: true })).toBe("R1.3bn");
  });

  it("drops a trailing .0 rather than implying precision", () => {
    expect(formatMoney(3_000_000, "ZAR", { compact: true })).toBe("R3m");
  });

  it("is deterministic — no locale or ICU dependence", () => {
    // The same call must produce identical text on the server and in a
    // browser, otherwise React discards the hydrated tree.
    const outputs = new Set(
      Array.from({ length: 5 }, () => formatMoney(3_400_000, "ZAR", { compact: true })),
    );
    expect(outputs.size).toBe(1);
    expect(formatMoney(3_400_000, "ZAR", { compact: true })).not.toMatch(/,/);
  });

  it("handles other currencies and unknown codes", () => {
    expect(formatMoney(1_000, "USD")).toBe("$1 000");
    expect(formatMoney(1_000, "AUD")).toBe("AUD 1 000");
  });

  it("returns an em dash for missing values", () => {
    expect(formatMoney(null, "ZAR")).toBe("—");
    expect(formatMoney(Number.NaN, "ZAR")).toBe("—");
  });
});

describe("formatRoi", () => {
  it("shows one decimal place", () => {
    expect(formatRoi(8.512)).toBe("8.5x");
  });
  it("shows N/A rather than a misleading zero", () => {
    expect(formatRoi(null)).toBe("N/A");
  });
});

describe("date formatting", () => {
  it("pins the time zone so server and client agree", () => {
    // 2026-09-05T22:30Z is already 6 September in Africa/Johannesburg.
    expect(formatDate("2026-09-05T22:30:00.000Z")).toBe("06 Sep 2026");
    expect(formatDateTime("2026-09-05T22:30:00.000Z")).toContain("06 Sep 2026");
  });

  it("degrades to an em dash on a missing or invalid value", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDateTime("not a date")).toBe("—");
  });
});
