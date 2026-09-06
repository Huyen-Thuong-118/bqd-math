import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/components/LoginForm";
import { isGoogleAuthConfigured } from "@/features/auth/lib/google-auth";

export const metadata: Metadata = {
  title: "Đăng nhập | BQD Math",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordChanged?: string | string[] }>;
}) {
  const query = await searchParams;
  return <LoginForm googleEnabled={isGoogleAuthConfigured()} passwordChanged={query.passwordChanged === "1"} />;
}
