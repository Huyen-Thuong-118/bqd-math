import type { Metadata } from "next";
import { FileQuestionMark } from "lucide-react";

import { AdminPlaceholder } from "@/components/layout/AdminPlaceholder";

export const metadata: Metadata = {
  title: "Đề thi thử | BQD Math",
};

// Stub — UI thật (bảng danh sách + gán đề vào lớp) sẽ làm ở prompt sau.
// KHÔNG đụng app/admin/de-thi/tao-moi/ — route đó đã có sẵn, tách riêng.
export default function AdminExamsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-navy-600">Đề thi thử</h1>
      <AdminPlaceholder
        icon={FileQuestionMark}
        description="Quản lý đề thi thử của tất cả các lớp, tìm kiếm và gán đề vào lớp học."
      />
    </section>
  );
}
