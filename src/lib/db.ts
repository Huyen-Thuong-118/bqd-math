import dns from "node:dns";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Ưu tiên IPv4 trước IPv6 khi phân giải DNS — xem giải thích chi tiết
// trong prisma.config.ts (cùng 1 nguyên nhân: mạng IPv6 bị lỗi định tuyến
// vẫn khá phổ biến, gây lỗi kết nối DB dù DB hoàn toàn khỏe).
dns.setDefaultResultOrder("ipv4first");

/**
 * Prisma 7: PrismaClient KHÔNG còn tự đọc connection string từ đâu cả —
 * bắt buộc phải truyền vào 1 "driver adapter". Ở đây dùng @prisma/adapter-pg
 * (chạy trên "pg" — driver Postgres chuẩn qua TCP), hoạt động tốt với cả
 * Neon lẫn Supabase vì cả 2 đều expose connection string Postgres chuẩn.
 *
 * DATABASE_URL dùng ở đây PHẢI là connection string QUA POOLER — khác với
 * prisma.config.ts (dùng DIRECT_URL cho migrate). Xem README mục
 * "Vì sao có prisma.config.ts" để hiểu rõ 2 file này chia việc thế nào.
 *
 * Singleton pattern giữ nguyên — tránh tạo nhiều Pool khi Next.js hot-reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Driver "pg" không đọc query param "connection_limit" trong URL (đó
    // là tham số riêng của Prisma engine cũ) — phải giới hạn ở đây. Giữ
    // nhỏ vì đây là serverless: mỗi function instance nên chỉ giữ ít
    // connection, để pooler (PgBouncer/Neon pooler) lo phần scale ra
    // nhiều instance. Xem SECURITY.md / ARCHITECTURE.md mục connection pooling.
    max: 3,
  });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
