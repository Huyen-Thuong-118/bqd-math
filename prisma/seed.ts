// Tạo/cập nhật đúng 1 tài khoản ADMIN (giáo viên chính) — ADMIN không đăng ký
// qua form, chỉ có được bằng cách chạy script này. Xem README "Bước tiếp theo".
//
// Chạy: npm run seed
// (hoặc npx prisma db seed / tự động sau `prisma migrate dev`, xem
// migrations.seed trong prisma.config.ts)
import "dotenv/config";

import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const phone = process.env.SEED_ADMIN_PHONE;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !phone || !password) {
    throw new Error(
      "Thiếu SEED_ADMIN_EMAIL / SEED_ADMIN_PHONE / SEED_ADMIN_PASSWORD trong .env — xem .env.example.",
    );
  }

  const passwordHash = await hashPassword(password);

  // parentPhone là field bắt buộc trên User (dùng cho HS), nhưng ADMIN không
  // có phụ huynh — tạm dùng lại SĐT admin cho field này. Xem ghi chú cuối
  // buổi làm schema: cân nhắc tách field riêng cho STUDENT nếu thấy gượng.
  const adminOnlyFields = {
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
    mustChangePassword: false,
    passwordHash,
    studentPhone: phone,
    parentPhone: phone,
  };

  const admin = await db.user.upsert({
    where: { email },
    update: adminOnlyFields,
    create: {
      name: "Admin BQD Math", // TODO: đổi tên thật, chỉ ảnh hưởng hiển thị
      email,
      ...adminOnlyFields,
    },
  });

  console.log(`Seed ADMIN OK: ${admin.email} (id: ${admin.id})`);
}

main()
  .catch((error) => {
    console.error("Seed thất bại:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
