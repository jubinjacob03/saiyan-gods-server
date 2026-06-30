import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/tmdb-api/:path*',
        destination: 'https://api.themoviedb.org/:path*',
      },
      {
        source: '/tmdb-image/:path*',
        destination: 'https://image.tmdb.org/:path*',
      }
    ];
  },
};

export default nextConfig;
