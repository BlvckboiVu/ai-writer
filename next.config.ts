/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Turbopack is now stable in development for Next.js 15.3
    // turbo: {
    //   rules: {
    //     '*.svg': {
    //       loaders: ['@svgr/webpack'],
    //       as: '*.js',
    //     },
    //   },
    // },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // Enable React 19 features
  reactStrictMode: true,
}

module.exports = nextConfig
