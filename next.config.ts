import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'imagedelivery.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Allow cross-origin requests from local network IPs
  allowedDevOrigins: [
    '192.168.86.150',
  ],
};

export default nextConfig;
