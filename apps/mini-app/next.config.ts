import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },
    ],
  },
  serverExternalPackages: [
    "@prisma/adapter-pg",
    "@prisma/client",
    "pg",
  ],
};

export default nextConfig;
