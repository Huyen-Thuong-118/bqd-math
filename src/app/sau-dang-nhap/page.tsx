import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  findAccountAccess,
  getAccountDestination,
} from "@/features/auth/lib/account-access";

export const dynamic = "force-dynamic";

export default async function PostLoginPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/dang-nhap");

  // Không tin role/status cũ trong JWT ở điểm quyết định quyền truy cập.
  const account = await findAccountAccess(session.user.id);
  if (!account) redirect("/dang-nhap");

  redirect(getAccountDestination(account));
}
