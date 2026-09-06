import "dotenv/config";

const required = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "GEMINI_API_KEY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "RESET_TOKEN_SECRET",
  "CRON_SECRET",
] as const;

const errors: string[] = [];
for (const key of required) {
  if (!process.env[key]?.trim()) errors.push(`Thiếu ${key}`);
}

const appUrl = process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
if (!appUrl) {
  errors.push("Thiếu AUTH_URL hoặc NEXTAUTH_URL");
} else {
  try {
    const url = new URL(appUrl);
    if (url.protocol !== "https:") errors.push("AUTH_URL/NEXTAUTH_URL production phải dùng HTTPS");
    if (["localhost", "127.0.0.1"].includes(url.hostname)) errors.push("AUTH_URL/NEXTAUTH_URL không được trỏ về máy local");
  } catch {
    errors.push("AUTH_URL/NEXTAUTH_URL không phải URL hợp lệ");
  }
}

if (process.env.AUTH_TRUST_HOST !== "true") {
  errors.push("AUTH_TRUST_HOST phải là true khi chạy sau Cloud Run proxy");
}

const serverActionsKey = process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY?.trim();
if (serverActionsKey) {
  const decodedLength = Buffer.from(serverActionsKey, "base64").length;
  if (![16, 24, 32].includes(decodedLength)) {
    errors.push("NEXT_SERVER_ACTIONS_ENCRYPTION_KEY phải là khóa AES base64 16, 24 hoặc 32 byte");
  }
}

for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
  const value = process.env[key]?.trim();
  if (value && /@(127\.0\.0\.1|localhost)(:|\/)/i.test(value)) {
    errors.push(`${key} không được trỏ về PostgreSQL local`);
  }
  if (value && !/[?&]sslmode=require(?:&|$)/i.test(value)) {
    errors.push(`${key} phải bật sslmode=require`);
  }
}

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("pooler")) {
  console.warn("Cảnh báo: DATABASE_URL không có 'pooler'; hãy xác nhận đây là pooled connection string.");
}

const googleId = Boolean(process.env.GOOGLE_CLIENT_ID?.trim());
const googleSecret = Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());
if (googleId !== googleSecret) errors.push("GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET phải được cấu hình cùng nhau");

if (errors.length) {
  console.error("Cấu hình production chưa đạt:\n- " + errors.join("\n- "));
  process.exitCode = 1;
} else {
  console.log("✓ Các biến môi trường production bắt buộc đã được cấu hình hợp lệ.");
}
