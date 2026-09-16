"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
      className="rounded-md border border-vx-border px-3 py-1.5 text-xs text-vx-muted hover:text-vx-text"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
