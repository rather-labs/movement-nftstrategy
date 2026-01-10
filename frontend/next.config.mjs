/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@aptos-labs/aptos-client', 'got'],
  experimental: {
    optimizePackageImports: ['@chakra-ui/react'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'robohash.org',
      },
    ],
  },
};

export default nextConfig;
