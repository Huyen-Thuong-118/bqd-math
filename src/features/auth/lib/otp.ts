import { createHmac, randomInt, timingSafeEqual } from "crypto";

/** 6 số ngẫu nhiên, dùng crypto.randomInt (CSPRNG) — Math.random không đủ an
 * toàn để sinh mã xác thực. `randomInt(0, 1_000_000)` cận trên loại trừ nên
 * range là 0..999999, pad về đủ 6 ký tự cho các số bắt đầu bằng 0. */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function getOtpSecret() {
  const value = process.env.PASSWORD_RESET_OTP_SECRET;
  if (!value) {
    throw new Error("Thiếu biến môi trường PASSWORD_RESET_OTP_SECRET.");
  }
  return value;
}

function hash(userId: string, otp: string): string {
  return createHmac("sha256", getOtpSecret())
    .update(`${userId}:${otp}`)
    .digest("hex");
}

function matches(userId: string, otp: string, storedHash: string): boolean {
  const expected = Buffer.from(hash(userId, otp), "utf8");
  const stored = Buffer.from(storedHash, "utf8");
  return expected.length === stored.length && timingSafeEqual(expected, stored);
}

/** HMAC theo user tránh brute-force offline mã OTP 6 số từ database bị lộ. */
export const verifyOtpHash = { hash, matches };
