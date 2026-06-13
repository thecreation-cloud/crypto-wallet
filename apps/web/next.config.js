/** @type {import('next').NextConfig} */

// Never use static export on Vercel — it runs a Node.js server and doesn't need it.
// Static export is only for Tauri desktop builds run locally.
const isStaticExport = process.env.NEXT_STATIC_EXPORT === "1" && !process.env.VERCEL;

const nextConfig = {
  output: isStaticExport ? "export" : undefined,
  trailingSlash: isStaticExport,
  images: isStaticExport ? { unoptimized: true } : undefined,
  transpilePackages: [
    "@wallet/core",
    "@wallet/store",
    "@wallet/ui",
    "@wallet/chain-ethereum",
    "@wallet/chain-solana",
    "@wallet/chain-bitcoin",
    "@wallet/chain-tron",
    "@wallet/chain-xrp",
    "@wallet/chain-near",
    "@wallet/chain-aptos",
  ],
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".jsx": [".tsx", ".jsx"],
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    return config;
  },
};

module.exports = nextConfig;
