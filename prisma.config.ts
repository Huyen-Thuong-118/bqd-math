import "dotenv/config";
import dns from "node:dns";
import { defineConfig, env } from "prisma/config";

/**
 * Ưu tiên phân giải DNS ra IPv4 trước IPv6. Từ Node 18, Node mặc định thử
 * IPv6 trước — trên mạng có IPv6 bị lỗi định tuyến (khá phổ biến ở modem/
 * router tại VN dù DNS vẫn trả IPv6 bình thường), Prisma CLI sẽ bị treo/
 * lỗi P1001 dù DB hoàn toàn khỏe (test qua SQL Editor trên web vẫn chạy
 * được vì trình duyệt tự né IPv6 hỏng, Node thì không). Nếu máy/mạng bạn
 * không có vấn đề IPv6, dòng này vô hại — chỉ đổi thứ tự thử, không tắt IPv6.
 */
dns.setDefaultResultOrder("ipv4first");

/**
 * Prisma 7 chuyển cấu hình connection string ra khỏi schema.prisma, sang
 * file này — CHỈ dùng bởi Prisma CLI (migrate, studio, db push...), không
 * ảnh hưởng app lúc chạy thật (app dùng driver adapter trong lib/db.ts).
 *
 * `url` ở đây PHẢI là connection string TRỰC TIẾP (không qua pooler), vì
 * lệnh migrate cần chạy DDL trực tiếp — dùng DIRECT_URL, không phải
 * DATABASE_URL. Xem README mục "Vì sao có prisma.config.ts".
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Prisma 7 đọc lệnh seed từ đây, KHÔNG còn từ field "prisma.seed" trong
    // package.json (quy ước cũ) — `npx prisma db seed` và `migrate dev` sẽ
    // tự chạy lệnh này. Script "seed" trong package.json chỉ để gọi tay
    // (`npm run seed`) mà không cần qua Prisma CLI.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
