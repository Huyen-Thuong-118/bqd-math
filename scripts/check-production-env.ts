import "dotenv/config";

const required = [
  "CLOUD_SQL_CONNECTION_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "GCS_BUCKET_NAME",
  "AUTH_SECRET",
  "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY",
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

const cloudSqlName = process.env.CLOUD_SQL_CONNECTION_NAME?.trim();
if (cloudSqlName && !/^[a-z][a-z0-9-]*:[a-z0-9-]+:[a-z][a-z0-9-]*$/.test(cloudSqlName)) {
  errors.push("CLOUD_SQL_CONNECTION_NAME phải có dạng PROJECT_ID:REGION:INSTANCE");
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
