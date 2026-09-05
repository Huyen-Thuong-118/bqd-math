import type { Metadata } from "next";

import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { isGoogleAuthConfigured } from "@/features/auth/lib/google-auth";

export const metadata: Metadata = {
  title: "Đăng ký | BQD Math",
};

export default function RegisterPage() {
  return <RegisterForm googleEnabled={isGoogleAuthConfigured()} />;
}
