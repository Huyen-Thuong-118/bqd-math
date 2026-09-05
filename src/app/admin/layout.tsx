import type { Metadata } from "next";

import { AdminSidebar } from "@/components/layout/AdminSidebar";

export const metadata: Metadata = {
  title: "Quản trị | BQD Math",
};

// Khung cho toàn bộ /admin/** — sidebar dashboard thay cho Navbar ngang.
// KHÔNG khai báo lại <html>/<body>/font ở đây: layout gốc app/layout.tsx đã
// lo phần đó, layout lồng nhau chỉ bọc thêm phần khung riêng của nhóm route.
// TODO: chặn truy cập nếu session không phải role ADMIN (xem features/auth).
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex flex-1">
      <AdminSidebar />
      <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
