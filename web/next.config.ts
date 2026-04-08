import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  transpilePackages: ['@fyndstigen/shared'],
  allowedDevOrigins: ['192.168.50.245'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*',
      },
    ]
  },
};

initOpenNextCloudflareForDev();

export default nextConfig;
