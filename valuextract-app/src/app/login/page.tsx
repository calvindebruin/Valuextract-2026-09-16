import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { bootstrap } from "@/lib/bootstrap";
import { Wordmark } from "@/components/brand/Wordmark";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await bootstrap();
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  const { next } = await searchParams;

  return (
    <main className="min-h-screen grid place-items-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Wordmark size="lg" />
          <div className="vx-gold-rule mt-4" />
          <p className="mt-4 text-sm text-vx-muted leading-relaxed">
            Convert agricultural financial information into actionable client value.
          </p>
        </div>
        <div className="vx-card p-6">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
