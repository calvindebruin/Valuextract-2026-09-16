/**
 * Runtime instruction for a ValueXtract Agri run.
 *
 * Deliberately short. The analysis method, opportunity catalog, evidence
 * rules, scoring, valuation and report specification all live inside the
 * registered Skill. Duplicating SKILL.md here would fork the logic and defeat
 * the point of versioned Skills, so this prompt only states the task, the
 * client context and the machine-readable contract the application needs back.
 */

export type PromptClient = {
  clientId: string;
  name: string;
  subsector?: string | null;
  financialYearEnd?: string | null;
  currency: string;
};

export type PromptDocument = {
  filename: string;
  category: string;
  periodLabel?: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  ANNUAL_FINANCIAL_STATEMENTS: "Annual Financial Statements",
  MANAGEMENT_ACCOUNTS: "Management Accounts",
  SUPPORTING_INFORMATION: "Supporting Information",
};

export function buildAnalysisPrompt(
  client: PromptClient,
  documents: PromptDocument[],
  options: { priorInformationRequests?: string[] } = {},
): string {
  const documentLines = documents
    .map(
      (d) =>
        `- ${d.filename} — ${CATEGORY_LABELS[d.category] ?? d.category}${
          d.periodLabel ? ` (${d.periodLabel})` : ""
        }`,
    )
    .join("\n");

  const followUp =
    options.priorInformationRequests?.length
      ? `\n<follow_up>\nA previous analysis of this client requested the information below. Where the supplied documents now answer any of it, raise the confidence of the affected opportunities and stop listing the item as outstanding.\n${options.priorInformationRequests
          .map((item) => `- ${item}`)
          .join("\n")}\n</follow_up>\n`
      : "";

  return `<task>
Apply the installed ValueXtract Agri Skill to the supplied agricultural client's financial information.

Analyse every supplied document, including where available the income statement, detailed income statement, balance sheet, cash flow statement, notes to the annual financial statements, management accounts and supporting schedules.

Identify financially supported ValueXtract triggers and commercial opportunities, and follow the Skill's evidence, scoring, valuation and consolidation rules.

Every material finding must be grounded in supplied financial evidence. Do not manufacture information. Where information is insufficient, mark the item as requiring confirmation and raise it under additional information requested. Never infer a source page number that is not visible in the document.
</task>

<client>
Client ID: ${client.clientId}
Client Name: ${client.name}
Sector: Agriculture
Subsector: ${client.subsector?.trim() || "Not stated — determine from the documents where the evidence supports it"}
Financial Period: ${client.financialYearEnd?.trim() || "Determine from the documents"}
Reporting Currency: ${client.currency}
</client>

<supplied_documents>
The documents below are available in your working directory.
${documentLines || "- (none)"}
</supplied_documents>
${followUp}
<output_contract>
The calling application consumes structured data, not prose.

1. Write the analysis to \`valuextract-data.json\` conforming exactly to the Skill's \`references/report-data.schema.json\`.
2. Then end your reply with that same JSON, complete and unabridged, inside a single \`\`\`json fenced code block and nothing after it.

The application recalculates every ROI and every portfolio total from your range endpoints, so supply honest low/high values rather than pre-rounded totals. Where two opportunities capture the same underlying value, give them a shared \`overlap_group\` string so the application counts that value once.

Do not produce the HTML report — the application renders its own interface from this data.
</output_contract>`;
}
