import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  basePath: '/GPT-Image-Studio',

  env: {
    NEXT_PUBLIC_BASE_PATH: '/GPT-Image-Studio',
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
