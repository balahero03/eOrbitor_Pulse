/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  allowedDevOrigins: ['192.168.1.143'],
};

module.exports = nextConfig;
