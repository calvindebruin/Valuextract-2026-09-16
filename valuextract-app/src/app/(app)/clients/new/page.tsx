import { requirePageUser } from "@/lib/auth/guards";
import { NewClientForm } from "./NewClientForm";

export default async function NewClientPage() {
  await requirePageUser("/clients/new");
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <p className="vx-eyebrow">New client</p>
      <h1 className="mt-2 text-2xl font-bold">Create an agricultural client</h1>
      <div className="vx-gold-rule mt-4 mb-8" />
      <div className="vx-card p-6">
        <NewClientForm />
      </div>
    </div>
  );
}
