/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActionsBodySizeLimit: "10mb",
  },
};
module.exports = nextConfig;
