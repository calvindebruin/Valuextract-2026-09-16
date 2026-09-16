import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { requirePageUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  await requirePageUser("/clients");
  const rows = await db.select().from(clients).orderBy(desc(clients.createdAt));

  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="vx-eyebrow">Clients</p>
          <h1 className="mt-2 text-2xl font-bold">Agricultural client portfolio</h1>
        </div>
        <Link
          href="/clients/new"
          className="rounded-lg bg-vx-gold px-4 py-2 text-sm font-semibold text-vx-navy hover:bg-vx-gold-light"
        >
          New client
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="vx-card p-10 text-center text-sm text-vx-muted">
          No clients yet.
        </div>
      ) : (
        <div className="vx-card scroll-x">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-vx-muted border-b border-vx-border">
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Subsector</th>
                <th className="px-4 py-3 font-medium">Year end</th>
                <th className="px-4 py-3 font-medium">Currency</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((client) => (
                <tr key={client.id} className="border-b border-vx-border-soft last:border-0">
                  <td className="px-4 py-3 font-medium">{client.name}</td>
                  <td className="px-4 py-3 text-vx-muted">{client.subsector || "—"}</td>
                  <td className="px-4 py-3 text-vx-muted">
                    {client.financialYearEnd || "—"}
                  </td>
                  <td className="px-4 py-3 text-vx-muted tabular">{client.currency}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/clients/${client.id}/valuextract-agri`}
                      className="text-vx-gold hover:underline"
                    >
                      Open analysis
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
