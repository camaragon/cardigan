import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Preserve loopback origins in Clerk rewrites behind a TLS-terminating proxy.
  skipProxyUrlNormalize: true,
  env: {
    PRIVATE_MODE: process.env.PRIVATE_MODE === "true" ? "true" : "false",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
