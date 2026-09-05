import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/components/LoginForm";
import { isGoogleAuthConfigured } from "@/features/auth/lib/google-auth";

export const metadata: Metadata = {
  title: "Đăng nhập | BQD Math",
};

export default function LoginPage() {
  return <LoginForm googleEnabled={isGoogleAuthConfigured()} />;
}
