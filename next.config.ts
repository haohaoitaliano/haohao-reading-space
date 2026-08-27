import type { NextConfig } from "next";

const allowedDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedDevOrigins?.length ? allowedDevOrigins : undefined,
  experimental: {
    proxyClientMaxBodySize: "110mb",
  },
  reactStrictMode: true,
};

export default nextConfig;
