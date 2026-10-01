import type { NextConfig } from "next";

const backendApiUrl = new URL(
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002/api",
);
const configuredApiPath = backendApiUrl.pathname.replace(/\/+$/, "");
const backendApiPath = configuredApiPath.endsWith("/api")
  ? configuredApiPath
  : `${configuredApiPath}/api`;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendApiUrl.origin}${backendApiPath}/:path*`,
      },
    ];
  },
};

export default nextConfig;
