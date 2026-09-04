import { jwtVerify, SignJWT } from "jose";

const RESET_TOKEN_PURPOSE = "password-reset";

// Fail sớm & rõ ràng nếu thiếu secret — im lặng dùng chuỗi "undefined" làm
// khoá ký (TextEncoder.encode(undefined) không throw) sẽ tạo lỗ hổng bảo mật
// khó phát hiện (ai cũng đoán được token hợp lệ).
function getSecret(): Uint8Array {
  const value = process.env.RESET_TOKEN_SECRET;
  if (!value) {
    throw new Error(
      "Thiếu biến môi trường RESET_TOKEN_SECRET (xem .env.example).",
    );
  }
  return new TextEncoder().encode(value);
}

/** Token ngắn hạn nối bước xác thực OTP (bước 2) và đặt mật khẩu mới (bước 3)
 * — không dùng lại OTP cho việc này vì OTP đã bị tiêu thụ (consumedAt) ngay
 * khi verify-otp thành công. */
export async function signResetToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: RESET_TOKEN_PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecret());
}

/** Trả về userId nếu token hợp lệ, đúng purpose và chưa hết hạn — null cho
 * MỌI trường hợp khác (không phân biệt lý do ra ngoài, tránh lộ chi tiết). */
export async function verifyResetToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== RESET_TOKEN_PURPOSE || typeof payload.sub !== "string") {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
}
