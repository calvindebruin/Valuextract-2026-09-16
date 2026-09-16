import Link from "next/link";
import { requirePageUser } from "@/lib/auth/guards";
import { bootstrap } from "@/lib/bootstrap";
import { Wordmark } from "@/components/brand/Wordmark";
import { SignOutButton } from "@/components/shell/SignOutButton";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await bootstrap();
  const user = await requirePageUser();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="no-print border-b border-vx-border bg-vx-bg-deep/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-7xl px-5 h-16 flex items-center gap-4">
          <Link href="/dashboard" className="shrink-0">
            <Wordmark />
          </Link>
          {/* min-w-0 + scroll keeps a long nav from widening the page on mobile. */}
          <nav className="flex-1 min-w-0 scroll-x flex items-center gap-1 text-sm">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/clients">Clients</NavLink>
            {user.role === "ADMIN" && <NavLink href="/admin/ai">AI Configuration</NavLink>}
            {user.role === "ADMIN" && <NavLink href="/admin/diagnostics">Diagnostics</NavLink>}
          </nav>
          <div className="shrink-0 flex items-center gap-3">
            <span className="hidden lg:block text-xs text-vx-muted whitespace-nowrap">
              {user.name}
              <span className="ml-2 rounded border border-vx-border px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                {user.role}
              </span>
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="no-print border-t border-vx-border py-6">
        <div className="mx-auto max-w-7xl px-5 text-xs text-vx-muted">
          ValueXtract · Private and confidential · Indicative values and fees, not a
          guarantee of results.
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-vx-muted hover:text-vx-text hover:bg-vx-card transition-colors"
    >
      {children}
    </Link>
  );
}
