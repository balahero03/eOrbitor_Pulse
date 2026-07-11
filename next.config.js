/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // pdf-parse (and its pdfjs-dist dependency) load worker/font/wasm resources
  // via runtime-relative paths that break when the bundler inlines them. Keep
  // it external so Next loads it through normal Node require at runtime.
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  allowedDevOrigins: ['192.168.1.143', '192.168.1.143:3000'],
};

module.exports = nextConfig;
