import type { ComponentType } from "react";

interface AdminPlaceholderProps {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  description: string;
}

/**
 * Khối "đang xây dựng" dùng chung cho các trang admin chưa có UI thật (đề
 * thi, câu hỏi ôn tập, tài liệu...) — tách ra đây để 3 trang stub không lặp
 * lại y hệt 1 đoạn markup. Server Component thuần, không state/hook nào nên
 * không cần "use client". Chỉ render phần khối giữa trang — <h1> tiêu đề
 * đầu trang vẫn để riêng trong từng page.tsx (khớp cách lop-hoc/lich-day
 * đang làm: <h1> rồi mới tới nội dung).
 */
export function AdminPlaceholder({ icon: Icon, description }: AdminPlaceholderProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-navy-200/60 bg-white/60 py-20 text-center">
      <Icon className="size-16 text-navy-500 opacity-20" aria-hidden />
      <p className="text-base font-semibold text-navy-500">
        Tính năng đang được xây dựng
      </p>
      <p className="max-w-sm text-sm text-navy-400">{description}</p>
    </div>
  );
}
