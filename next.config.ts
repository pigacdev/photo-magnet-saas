import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const apiInternal =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const base = apiInternal.replace(/\/$/, "");
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: "/uploads/:path*",
          destination: `${base}/uploads/:path*`,
        },
        {
          source: "/api/:path*",
          destination: `${base}/api/:path*`,
        },
      ],
    };
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
