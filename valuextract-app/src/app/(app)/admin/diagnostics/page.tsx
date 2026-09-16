import { requirePageAdmin } from "@/lib/auth/guards";
import { DiagnosticsPanel } from "./DiagnosticsPanel";

export const dynamic = "force-dynamic";

export default async function DiagnosticsPage() {
  await requirePageAdmin("/admin/diagnostics");
  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <p className="vx-eyebrow">Developer diagnostics</p>
      <h1 className="mt-2 text-2xl font-bold">Integration status</h1>
      <div className="vx-gold-rule mt-4 mb-8" />
      <DiagnosticsPanel />
    </div>
  );
}
