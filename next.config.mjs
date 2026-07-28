/** @type {import('next').NextConfig} */
const nextConfig = {
  // Runs instrumentation.ts on boot, which warms the campaign cache so the
  // first visitor does not wait on the upstream's cold start.
  experimental: { instrumentationHook: true },
};

export default nextConfig;
