"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SUBSECTORS = [
  "Row crops / grain",
  "Deciduous fruit",
  "Citrus",
  "Table grapes / wine",
  "Nuts",
  "Vegetables",
  "Livestock — cattle",
  "Livestock — sheep",
  "Poultry",
  "Dairy",
  "Packhouse / processing",
  "Export / marketing",
  "Mixed farming",
  "Other",
];

export function NewClientForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          subsector: String(form.get("subsector") ?? "") || null,
          financialYearEnd: String(form.get("financialYearEnd") ?? "") || null,
          currency: String(form.get("currency") ?? "ZAR"),
          registrationNumber: String(form.get("registrationNumber") ?? "") || null,
          notes: String(form.get("notes") ?? "") || null,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? "Could not create the client.");
        return;
      }
      router.push(`/clients/${body.id}/valuextract-agri`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field label="Client name" htmlFor="name">
        <input
          id="name"
          name="name"
          required
          placeholder="JJ Gouws Boerdery (Pty) Ltd"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Agricultural subsector" htmlFor="subsector">
          <select id="subsector" name="subsector" className={inputClass} defaultValue="">
            <option value="">Determine from documents</option>
            {SUBSECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Financial year end" htmlFor="financialYearEnd">
          <input
            id="financialYearEnd"
            name="financialYearEnd"
            placeholder="28 February 2026"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Reporting currency" htmlFor="currency">
          <input
            id="currency"
            name="currency"
            defaultValue="ZAR"
            maxLength={3}
            className={`${inputClass} uppercase tabular`}
          />
        </Field>
        <Field label="Registration number" htmlFor="registrationNumber">
          <input id="registrationNumber" name="registrationNumber" className={inputClass} />
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes">
        <textarea id="notes" name="notes" rows={3} className={inputClass} />
      </Field>

      {error && (
        <p role="alert" className="text-sm text-[#ff8f9b]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-vx-gold px-4 py-2.5 text-sm font-semibold text-vx-navy hover:bg-vx-gold-light disabled:opacity-60"
      >
        {busy ? "Creating…" : "Create client"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg bg-vx-card-2 border border-vx-border px-3 py-2.5 text-sm outline-none focus:border-vx-gold";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="vx-eyebrow block mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
