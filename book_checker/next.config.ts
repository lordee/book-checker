import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: process.env.NODE_ENV === 'production' ? '/api/hassio_ingress/book_checker' : '',
  trailingSlash: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's.gr-assets.com',
      },
      {
        protocol: 'https',
        hostname: 'images-na.ssl-images-amazon.com',
      },
      {
        protocol: 'https',
        hostname: 'i.gr-assets.com',
      }
    ],
  },
};

export default nextConfig;
