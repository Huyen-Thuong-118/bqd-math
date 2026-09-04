import type { Metadata } from "next";

import { RegisterForm } from "@/features/auth/components/RegisterForm";

export const metadata: Metadata = {
  title: "Đăng ký | BQD Math",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
