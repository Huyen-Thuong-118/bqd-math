import type { Metadata } from "next";

import { db } from "@/lib/db";
import { AccountsPage } from "@/features/accounts/components/AccountsPage";

export const metadata: Metadata = {
  title: "Quản lý học sinh | BQD Math",
};

// Trang này KHÔNG dùng dynamic API nào (không cookies()/headers()/searchParams,
// không tự gọi auth() — proxy đã chặn /admin/** trước khi request tới đây) và
// db.user.findMany() là 1 lệnh Prisma thuần, không phải fetch() nên không tự
// tham gia Data Cache của Next — build đã thật sự đánh dấu route này "○
// Static" (đã tự build và xem log để xác nhận). Nếu không ép dynamic, trang
// có nguy cơ chỉ hiện đúng snapshot học sinh tại thời điểm build cho tới lần
// deploy kế tiếp, bất kể revalidatePath()/router.refresh() sau mỗi hành động
// — admin thấy dữ liệu cũ mà không rõ vì sao. Đây là trang nội bộ, không cần
// tối ưu tốc độ bằng static cache, nên ép dynamic cho chắc chắn luôn đúng.
export const dynamic = "force-dynamic";

// Duyệt/thu hồi/kích hoạt lại tài khoản học sinh — xem features/accounts.
// Server Component: fetch thẳng bằng Prisma, không qua route API riêng.
// AccountsPage chỉ nhận state BAN ĐẦU rồi tự gọi server actions
// (features/accounts/actions.ts) cho các thao tác Duyệt/Từ chối/Thu hồi/
// Kích hoạt lại — router.refresh() ở đó sẽ chạy lại đúng hàm này để đồng bộ.
export default async function AdminStudentsPage() {
  // `select` CỐ Ý chỉ lấy đúng field AccountsTable cần hiển thị — findMany()
  // không lọc field sẽ kéo theo passwordHash vào RSC payload gửi xuống
  // Client Component, tức là đẩy hash mật khẩu ra tới trình duyệt dù chỉ để
  // hiển thị bảng, không phải lỗi nghiêm trọng ngay lập tức (vẫn là hash 1
  // chiều) nhưng không có lý do gì phải chấp nhận rủi ro đó.
  const accounts = await db.user.findMany({
    where: { role: "STUDENT" },
    select: {
      id: true,
      name: true,
      email: true,
      studentCode: true,
      studentPhone: true,
      parentPhone: true,
      status: true,
      createdAt: true,
      suspendedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return <AccountsPage initialAccounts={accounts} />;
}
