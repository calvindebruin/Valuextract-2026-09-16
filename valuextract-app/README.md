# ValueXtract — Agri Analysis

An application that runs the custom **ValueXtract Agri** Claude Agent Skill against a
client's financial information and turns the result into an interactive, exportable
ValueXtract report.

```
Frontend
   ↓
Secure server API  (Next.js route handlers — the only place the API key exists)
   ↓
Anthropic Messages API  (container.skills + code execution)
   ↓
Custom ValueXtract Agri Skill
   ↓
Structured JSON  (valuextract-data.json)
   ↓
Zod validation + deterministic recalculation
   ↓
Database
   ↓
ValueXtract report UI  →  PDF
```

---

## 1. Getting started

```bash
npm install
cp .env.example .env.local        # then edit it
npm run seed                      # creates the admin user and a sample client
npm run dev                       # http://localhost:3000
```

Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env.local`, then go to
**Settings → AI Configuration**.

### Required environment values

| Variable | Purpose |
| --- | --- |
| `SESSION_SECRET` | Signs session cookies and short-lived PDF print tokens |
| `APP_ENCRYPTION_KEY` | AES-256-GCM key that encrypts the stored Anthropic API key |
| `DATABASE_URL` | SQLite file by default (`file:./data/valuextract.db`) |
| `STORAGE_DIR` | Where uploaded documents are written |

Anthropic settings (`ANTHROPIC_API_KEY`, `VALUEXTRACT_AGRI_SKILL_ID`, …) may be set in
`.env.local` for development, but production should use the admin settings page or the
deployment platform's secret store. `.env*` files are git-ignored.

---

## 2. Registering the Skill

The Skill bundle lives at `skill/valuextract-agri/` (SKILL.md plus its `references/` and
`scripts/`). It must be registered with Anthropic **once**; an analysis run never uploads
it.

Either use **Settings → AI Configuration → Register as a new Skill**, or:

```bash
npm run skill:register                        # create
npm run skill:register -- --skill-id skill_01…  # publish a new version
```

The returned `skill_01…` id is saved to the application settings automatically when
registered from the admin page. Pin an explicit `skver_01…` version in production so
historical reports stay reproducible; `latest` is fine in development.

**Verify skill** in the same page confirms the Skill exists, lists its versions, and shows
which version `latest` currently resolves to. It can also list the workspace's custom
Skills if you have lost the id.

---

## 3. Running an analysis

1. **Clients → New client** (or pick an existing one).
2. Upload documents under **Annual Financial Statements**, **Management Accounts** and
   **Supporting Information**. PDF, XLSX, XLS, CSV, DOCX and TXT are accepted.
3. **✦ Analyse with ValueXtract Agri**. The button stays disabled until financial
   statements or management accounts are present and the AI configuration is complete.
4. The job progresses through real states — `QUEUED → PROCESSING → VALIDATING →
   COMPLETED` — and the progress panel shows only stages that have actually been reached.
5. The report opens when the run completes. You can leave the page; the analysis
   continues server-side.

**Upload additional information** re-runs the analysis as a new version, carrying the
previous run's outstanding information requests into the prompt, and archives the old
analysis rather than overwriting it. Every version stays readable under
*Previous analyses*.

---

## 4. How the model output is treated

The Skill's `references/report-data.schema.json` is the canonical contract.
`src/lib/valuextract/schema.ts` is its executable mirror; nothing is persisted or
rendered without passing through it.

Nothing arithmetic that a client sees comes from model prose:

- **Opportunity ROI** = midpoint(client value) ÷ midpoint(fee), recomputed in
  `src/lib/valuextract/calculations.ts`. The model's own `roi` is stored separately as
  `model_reported_roi` so a discrepancy can be investigated, and is never displayed.
- **Portfolio ROI** = midpoint(total value) ÷ midpoint(total fees) — never the average of
  individual ROIs.
- **Overlap control**: opportunities sharing an `overlap_group` contribute their value
  once; the others stay visible in the report, flagged, rather than being dropped.
- A **source page number** is displayed only when the analysis actually observed one.
  `null` renders as no page reference.

The runtime prompt (`src/lib/anthropic/prompt.ts`) is deliberately short — the analysis
method lives in the versioned Skill, not in the application.

---

## 5. Security

- The Anthropic SDK is instantiated only in modules marked `server-only`. A client
  component that imported one would fail the build.
- The saved API key is encrypted at rest and is **never** returned to a browser; the
  settings page shows a mask.
- No `NEXT_PUBLIC_` variable carries a credential, and nothing is written to browser
  storage. `tests/security.test.ts` enforces all of this by scanning the source tree.
- End users never supply their own key: ValueXtract owns the Anthropic account, and only
  administrators can reach AI configuration.
- Logs record error classes, durations and token counts. Key material is redacted and
  document contents are never logged.

---

## 6. PDF export

`GET /api/analyses/:id/pdf` renders the application's own print layout with headless
Chromium — the same structured data the interactive report uses, so the PDF can never
disagree with the screen. Claude is not called again.

Set `CHROMIUM_EXECUTABLE_PATH` if no Chromium is on the default paths; when none is
found the endpoint returns a clear 503 and the UI suggests the browser's print dialogue.
Print styles switch to a light, ink-efficient palette, keep opportunity cards whole,
repeat table headers and expand evidence disclosures.

---

## 7. Taxonomy and CapMatch

The ValueXtract taxonomy is intentionally **not** embedded in the prompt. The Skill
returns `trigger_id`, `service_line` and `agri_category`; `src/lib/valuextract/taxonomy.ts`
is the seam where those are later resolved:

```
trigger id → taxonomy → service opportunity → referral partner / internal → CapMatch
```

The default resolver is a pass-through that records "unmatched", so no fabricated mapping
is ever stored. Replace it with `setTaxonomyResolver(...)` when the taxonomy tables land —
nothing else in the pipeline changes.

Funding-related opportunities may carry `capmatch_eligible`, capital requirement ranges
and possible funding categories. These are stored and displayed; no funder matching is
performed yet.

---

## 8. Project layout

```
src/lib/anthropic/     SDK client, Skill registration/verification, the analysis run
src/lib/valuextract/   schema contract, deterministic calculations, persistence, taxonomy
src/lib/jobs/          analysis job state machine
src/lib/config/        encrypted AI configuration
src/lib/db/            schema and SQL migrations
src/components/report/ report UI shared by the screen and the PDF
skill/valuextract-agri Skill bundle uploaded to Anthropic
scripts/               seed and skill registration CLIs
tests/                 vitest suites
```

### Moving to Postgres

`src/lib/db/migrate.ts` holds plain SQL, and `src/lib/db/schema.ts` is Drizzle. Swap the
driver in `src/lib/db/index.ts` for `drizzle-orm/node-postgres`, translate the SQL (the
only SQLite-specific parts are the `strftime` defaults and integer booleans), and point
`DATABASE_URL` at the cluster.

---

## 9. Commands

```bash
npm run dev             # development server
npm run build           # production build
npm test                # vitest suites
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run seed            # admin user + sample client
npm run skill:register  # register or version the Skill with Anthropic
```

No real client documents are committed to this repository.
