import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ['@fyndstigen/shared'],
  allowedDevOrigins: ['192.168.50.245'],
  experimental: {
    // Inline Tailwind CSS in <head> to remove the render-blocking CSS request.
    // Atomic CSS stays small enough that the cache trade-off is worth it.
    inlineCss: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'yqeegfhwbjnlrdurstxp.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*',
      },
    ]
  },
  async headers() {
    // Single-line CSP. unsafe-inline + unsafe-eval are required:
    //   - inline-css: Next.js (inlineCss: true above) inlines Tailwind in <head>
    //   - inline-script: Next.js bootstrap + react hydration data
    //   - eval: PostHog session-recording uses new Function() in its rrweb bundle
    // Allowlist drives the actual security — only these external hosts may be
    // contacted/embedded. Sentry is same-origin via tunnelRoute '/monitoring'.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://eu-assets.i.posthog.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://yqeegfhwbjnlrdurstxp.supabase.co https://*.stripe.com",
      "font-src 'self' data:",
      "connect-src 'self' https://yqeegfhwbjnlrdurstxp.supabase.co wss://yqeegfhwbjnlrdurstxp.supabase.co https://eu.i.posthog.com https://eu-assets.i.posthog.com https://api.stripe.com https://m.stripe.network https://r.stripe.com https://router.project-osrm.org https://nominatim.openstreetmap.org",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ]
  },
};

initOpenNextCloudflareForDev();

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Source map upload — set SENTRY_AUTH_TOKEN in .env.sentry-build-plugin or CI
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload wider set of client source files for better stack traces
  widenClientFileUpload: true,

  // Proxy route to bypass ad-blockers
  tunnelRoute: "/monitoring",

  // Suppress non-CI output
  silent: !process.env.CI,
});
