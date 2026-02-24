/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcrypt'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('bcrypt');
    }
    // Ignore node-pre-gyp warnings
    config.resolve.alias = {
      ...config.resolve.alias,
      'mock-aws-s3': false,
      'aws-sdk': false,
      'nock': false,
    };
    return config;
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig