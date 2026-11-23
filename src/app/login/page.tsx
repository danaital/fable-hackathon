import { LoginForm } from "@/features/auth/LoginForm";
import { safeReturnPath } from "@/features/auth/model";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <LoginForm returnTo={safeReturnPath(typeof next === "string" ? next : null)} />;
}
