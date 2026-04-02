import type { NextConfig } from "next";

const apiInternal =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternal.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
