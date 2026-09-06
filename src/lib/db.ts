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
 * (chạy trên "pg" — driver Postgres chuẩn). Trên Cloud Run, app kết nối
 * Cloud SQL qua Unix socket do Cloud Run cung cấp; ở local vẫn dùng URL.
 *
 * Singleton pattern giữ nguyên — tránh tạo nhiều Pool khi Next.js hot-reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const cloudSqlConnectionName = process.env.CLOUD_SQL_CONNECTION_NAME?.trim();
  let adapter: PrismaPg;

  if (cloudSqlConnectionName) {
    const required = ["DB_USER", "DB_PASSWORD", "DB_NAME"] as const;
    const missing = required.filter((name) => !process.env[name]?.trim());
    if (missing.length > 0) {
      throw new Error(`Thiếu biến môi trường Cloud SQL: ${missing.join(", ")}.`);
    }

    adapter = new PrismaPg({
      host: `/cloudsql/${cloudSqlConnectionName}`,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      max: 3,
    });
  } else if (process.env.DB_HOST?.trim()) {
    const required = ["DB_USER", "DB_PASSWORD", "DB_NAME"] as const;
    const missing = required.filter((name) => !process.env[name]?.trim());
    if (missing.length > 0) {
      throw new Error(`Thiếu biến môi trường PostgreSQL: ${missing.join(", ")}.`);
    }

    adapter = new PrismaPg({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      max: 3,
    });
  } else {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("Thiếu DATABASE_URL hoặc CLOUD_SQL_CONNECTION_NAME.");
    }
    adapter = new PrismaPg({ connectionString, max: 3 });
  }

  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
