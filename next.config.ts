import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

export default withSentryConfig(nextConfig, {
  silent: true,
  // Only upload source maps when SENTRY_AUTH_TOKEN is set (CI/Vercel)
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  disableSourceMapUpload: !process.env.SENTRY_AUTH_TOKEN,
})
