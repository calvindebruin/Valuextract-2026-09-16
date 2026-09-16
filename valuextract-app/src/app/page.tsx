import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { bootstrap } from "@/lib/bootstrap";

export default async function Home() {
  await bootstrap();
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
