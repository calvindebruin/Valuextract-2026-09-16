import { requirePageAdmin } from "@/lib/auth/guards";
import { getPublicAiConfig, CODE_EXECUTION_TOOL_CANDIDATES } from "@/lib/config/ai-config";
import { env } from "@/lib/env";
import { AiSettingsForm } from "./AiSettingsForm";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  await requirePageAdmin("/admin/ai");
  const config = await getPublicAiConfig();

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <p className="vx-eyebrow">Settings → AI Configuration</p>
      <h1 className="mt-2 text-2xl font-bold">Anthropic / Claude</h1>
      <div className="vx-gold-rule mt-4 mb-8" />

      <AiSettingsForm
        initial={config}
        toolOptions={[...CODE_EXECUTION_TOOL_CANDIDATES]}
        skillSourceDir={env.skillSourceDir}
      />

      <section className="vx-card p-5 mt-8 text-sm text-vx-muted leading-relaxed">
        <h2 className="vx-eyebrow mb-3">How credentials are handled</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            The API key is encrypted with AES-256-GCM before it is stored and is never
            returned to a browser — this page only ever shows a mask.
          </li>
          <li>
            Anthropic is called exclusively from server routes. No key reaches client
            JavaScript, local storage, or any <code>NEXT_PUBLIC_</code> variable.
          </li>
          <li>
            End users never supply their own key: ValueXtract holds the Anthropic account
            and users consume ValueXtract usage.
          </li>
          <li>
            For development you may instead set <code>ANTHROPIC_API_KEY</code> and{" "}
            <code>VALUEXTRACT_AGRI_SKILL_ID</code> in <code>.env.local</code>, which is
            git-ignored.
          </li>
        </ul>
      </section>
    </div>
  );
}
