import { imageHosts } from './image-hosts.config.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
  distDir: process.env.DIST_DIR || '.next',

  images: {
    remotePatterns: imageHosts,
  },

  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
