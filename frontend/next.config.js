/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    watchOptions: {
      poll: true,
    },
  },
};

export default nextConfig;