import bcrypt from "bcryptjs";
import crypto from "crypto";

// 12 rounds là mức khuyến nghị hiện tại cho bcrypt (cân bằng bảo mật/tốc độ
// trên serverless — cao hơn làm request đăng nhập chậm rõ rệt).
const SALT_ROUNDS = 12;

/** Băm mật khẩu — dùng khi HS đăng ký hoặc tự đổi mật khẩu. */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/** So khớp mật khẩu lúc đăng nhập — KHÔNG BAO GIỜ so sánh chuỗi trực tiếp. */
export async function verifyPassword(
  plainPassword: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

/**
 * Sinh mật khẩu tạm ngẫu nhiên, an toàn — dùng khi ADMIN RESET mật khẩu
 * cho HS (thay vì "xem lại" mật khẩu cũ, xem ghi chú trong schema.prisma
 * model User). Admin chỉ thấy chuỗi này ĐÚNG 1 LẦN lúc vừa tạo, không lưu
 * lại dạng đọc được ở đâu khác — DB chỉ lưu hash của nó.
 *
 * Dùng bảng chữ dễ đọc, tránh ký tự dễ nhầm (0/O, 1/l/I) vì admin có thể
 * phải đọc cho HS qua điện thoại.
 */
export function generateTempPassword(length = 10): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
