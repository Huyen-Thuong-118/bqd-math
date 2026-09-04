import type { AccountStatus } from "../types";

// Vàng/xanh lá/đỏ không có trong theme (chỉ navy + pastel-blue) — dùng thẳng
// bảng màu mặc định của Tailwind, hợp lý cho trạng thái vì đây là 3 tông
// "đèn giao thông" quen thuộc, không phải màu thương hiệu của trang.
const STATUS_CONFIG: Record<AccountStatus, { label: string; className: string }> = {
  PENDING: { label: "Chờ duyệt", className: "bg-amber-100 text-amber-700" },
  ACTIVE: { label: "Đang hoạt động", className: "bg-green-100 text-green-700" },
  SUSPENDED: { label: "Ngưng hoạt động", className: "bg-red-100 text-red-700" },
};

export function StatusBadge({ status }: { status: AccountStatus }) {
  const { label, className } = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
