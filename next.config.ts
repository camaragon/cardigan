import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
