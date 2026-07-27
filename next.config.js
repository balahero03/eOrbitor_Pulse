const os = require('os');

function getLocalDevOrigins() {
  const origins = ['localhost', 'localhost:3000', '127.0.0.1', '127.0.0.1:3000'];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
        origins.push(net.address);
        origins.push(`${net.address}:3000`);
      }
    }
  }
  return origins;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  allowedDevOrigins: getLocalDevOrigins(),
};

module.exports = nextConfig;
