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

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Response headers applied to every route.
 *
 * The app previously sent none of these, so the CRM could be framed by any
 * origin (clickjacking a Delete or Approve button), and full URLs — which carry
 * record ids — leaked to any external site a user navigated to.
 *
 * On the CSP: Next's App Router inlines its hydration bootstrap, and there is
 * no nonce plumbing here, so `script-src` has to permit 'unsafe-inline'. That
 * directive is therefore not doing XSS work — `lib/sanitizeHtml.ts` is what
 * stands between a rich-text field and the one dangerouslySetInnerHTML sink.
 * The rest of the policy still earns its place: `frame-ancestors` and
 * `object-src` close off framing and plugin embedding, `base-uri` and
 * `form-action` stop an injected tag retargeting relative URLs or posting a
 * form off-site, and `connect-src 'self'` means injected script cannot quietly
 * ship customer data to another host.
 */
const CSP = [
  "default-src 'self'",
  // 'unsafe-eval' is required by React Refresh in dev only.
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Send the origin cross-site but never the path — record ids live in paths.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // Production only, and deliberately without `preload`. The public deployment
  // is HTTPS via the Cloudflare Tunnel, but dev serves plain HTTP on
  // localhost — sending this there would pin HSTS for localhost in the
  // developer's browser and break every other local HTTP project. `preload` is
  // omitted because it is the part that cannot be walked back.
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
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
