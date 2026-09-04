import { createHash, randomInt } from "crypto";

/** 6 số ngẫu nhiên, dùng crypto.randomInt (CSPRNG) — Math.random không đủ an
 * toàn để sinh mã xác thực. `randomInt(0, 1_000_000)` cận trên loại trừ nên
 * range là 0..999999, pad về đủ 6 ký tự cho các số bắt đầu bằng 0. */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** OTP sống rất ngắn (5 phút) nên hash SHA-256 đơn giản là đủ, không cần
 * bcrypt (chậm hơn nhiều, không cần thiết cho dữ liệu hết hạn nhanh). */
export function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}
