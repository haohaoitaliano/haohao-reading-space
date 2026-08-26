import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "110mb",
  },
  reactStrictMode: true,
};

export default nextConfig;
