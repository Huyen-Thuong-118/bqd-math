import type { Metadata } from "next";
import { Folder } from "lucide-react";

import { AdminPlaceholder } from "@/components/layout/AdminPlaceholder";

export const metadata: Metadata = {
  title: "Tài liệu | BQD Math",
};

// Stub — model Folder/Document đã có sẵn trong schema, đủ dữ liệu để dựng
// UI thật ở prompt sau.
export default function AdminDocumentsPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-navy-600">Tài liệu</h1>
      <AdminPlaceholder
        icon={Folder}
        description="Kho tài liệu chung, sắp xếp theo thư mục và chia sẻ vào từng lớp."
      />
    </section>
  );
}
