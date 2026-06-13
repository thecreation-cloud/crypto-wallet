/** @type {import('next').NextConfig} */

const isStaticExport = process.env.NEXT_STATIC_EXPORT === "1";

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
