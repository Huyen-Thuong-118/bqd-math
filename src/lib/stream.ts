/**
 * Client gọi Cloudflare Stream API — dùng cho video lời giải.
 * Vì sao không để video thô trong R2: Stream tự động encode nhiều độ phân
 * giải (adaptive bitrate) — quan trọng vì HS xem bằng mạng 4G ở nhiều nơi
 * khác nhau. Xem ARCHITECTURE.md mục "Lưu trữ tài liệu".
 *
 * Cloudflare Stream không có SDK Node chính thức — gọi thẳng REST API.
 */
const BASE_URL = (accountId: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`;

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
  };
}

/**
 * Lấy URL upload trực tiếp (direct creator upload) — cho phép admin upload
 * video thẳng từ trình duyệt lên Cloudflare, không phải qua server của
 * mình trung chuyển (tránh tốn băng thông + timeout với video dài).
 */
export async function createDirectUploadUrl(maxDurationSeconds = 3600) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
  const res = await fetch(`${BASE_URL(accountId)}/direct_upload`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      maxDurationSeconds,
      requireSignedURLs: true, // bắt buộc token mới xem được — chặn hotlink
    }),
  });

  if (!res.ok) {
    throw new Error(`Cloudflare Stream direct_upload thất bại: ${res.status}`);
  }

  const data = await res.json();
  return data.result as { uploadURL: string; uid: string };
}

/**
 * Sinh signed token để phát video — HS chỉ xem được nếu GV đã bật video
 * (videoUrl khác null trong ReviewQuestion) và có token hợp lệ, thời hạn
 * ngắn tương tự signed URL của PDF.
 */
export async function getSignedStreamToken(videoUid: string, expiresInSeconds = 3600) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;

  const res = await fetch(`${BASE_URL(accountId)}/${videoUid}/token`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ exp }),
  });

  if (!res.ok) {
    throw new Error(`Cloudflare Stream token thất bại: ${res.status}`);
  }

  const data = await res.json();
  return data.result.token as string;
}

/** Build URL HLS player nhúng vào trang, kèm token đã ký. */
export function buildStreamPlaybackUrl(videoUid: string, token: string) {
  return `https://customer-${process.env.CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${token}/manifest/video.m3u8`;
}
