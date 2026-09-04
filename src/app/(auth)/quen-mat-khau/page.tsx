import type { Metadata } from "next";

import { ForgotPasswordFlow } from "@/features/auth/components/ForgotPasswordFlow";

export const metadata: Metadata = {
  title: "Quên mật khẩu | BQD Math",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordFlow />;
}
