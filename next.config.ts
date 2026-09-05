import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // MVP nhận tối đa 2 PDF x 20 MB qua Server Action. Production quy mô lớn
    // nên đổi sang presigned direct upload R2 để file không đi qua app server.
    serverActions: { bodySizeLimit: "42mb" },
  },
};

export default nextConfig;
