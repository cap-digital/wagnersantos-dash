/** @type {import('next').NextConfig} */
const nextConfig = {
  // Runs instrumentation.ts on boot, which warms the pre-campaign cache so the
  // first visitor does not wait on that source's cold start.
  experimental: { instrumentationHook: true },

  // The dashboard used to be a single panel at these paths. They now belong to
  // the pre-campaign, which is the data those links were always showing.
  async redirects() {
    return [
      { source: "/visao-geral", destination: "/pre-campanha/visao-geral", permanent: true },
      { source: "/criativos", destination: "/pre-campanha/criativos", permanent: true },
    ];
  },
};

export default nextConfig;
