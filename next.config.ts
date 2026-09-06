import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://storage.googleapis.com https://*.storage.googleapis.com https://*.cloudflarestream.com",
  "media-src 'self' blob: https://*.cloudflarestream.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  // Cloud Run chỉ cần server tối thiểu + các dependency đã được Next trace.
  // Dockerfile copy `.next/standalone`, `public` và `.next/static` sang image.
  output: "standalone",
  // Mỗi Cloud Build dùng BUILD_ID riêng để Next phát hiện version skew khi
  // Cloud Run đang chuyển traffic giữa hai revision.
  deploymentId: process.env.DEPLOYMENT_VERSION,
  poweredByHeader: false,
  experimental: {
    // Local chưa có Cloud Storage nên Server Action có thể nhận cùng lúc hai PDF,
    // mỗi file tối đa 20 MB. Chừa thêm dung lượng cho multipart/form-data.
    // Production upload thẳng lên Cloud Storage bằng signed URL và chỉ gửi metadata,
    // vì vậy vẫn giữ giới hạn thấp để giảm mức dùng tài nguyên và rủi ro request lớn.
    serverActions: { bodySizeLimit: isDevelopment ? "41mb" : "2mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
