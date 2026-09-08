const TEST_DATABASE_MARKER = "true";

function databaseName(connectionString: string) {
  try {
    return decodeURIComponent(new URL(connectionString).pathname)
      .replace(/^\/+/, "")
      .toLowerCase();
  } catch {
    throw new Error("DATABASE_URL không phải PostgreSQL connection string hợp lệ.");
  }
}

/**
 * Verification scripts tạo, cập nhật và xóa dữ liệu. Chặn cứng mọi lần chạy
 * không chỉ rõ database test để không thể vô tình dùng DATABASE_URL production.
 */
export function requireTestDatabase() {
  const connectionString = process.env.DATABASE_URL?.trim();
  const declaredTestUrl = process.env.TEST_DATABASE_URL?.trim();

  if (process.env.BQD_MATH_TEST_DATABASE !== TEST_DATABASE_MARKER) {
    throw new Error(
      "Từ chối chạy verification: đặt BQD_MATH_TEST_DATABASE=true và cấu hình test database riêng.",
    );
  }

  if (!connectionString || !declaredTestUrl || connectionString !== declaredTestUrl) {
    throw new Error(
      "Từ chối chạy verification: DATABASE_URL phải khớp chính xác TEST_DATABASE_URL.",
    );
  }

  const name = databaseName(connectionString);
  if (!/(^|[-_])test(?:ing)?($|[-_])/.test(name)) {
    throw new Error(
      `Từ chối chạy verification: database \"${name}\" phải có hậu tố hoặc tiền tố test/testing.`,
    );
  }
}
