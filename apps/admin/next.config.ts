import type { NextConfig } from "next";

function getSupabaseStoragePattern(): {
  hostname: string;
  pathname: string;
  protocol: "https";
} | null {
  const value = process.env.SUPABASE_URL;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "product-images";

  if (!value || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(bucket)) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:"
      ? {
          protocol: "https",
          hostname: url.hostname,
          pathname: `/storage/v1/object/public/${bucket}/**`,
        }
      : null;
  } catch {
    return null;
  }
}

const supabaseStoragePattern = getSupabaseStoragePattern();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      ...(supabaseStoragePattern ? [supabaseStoragePattern] : []),
    ],
  },
  serverExternalPackages: [
    "@prisma/adapter-pg",
    "@prisma/client",
    "pg",
  ],
};

export default nextConfig;
