/* eslint-disable no-var */
declare var process: { env: Record<string, string | undefined> } | undefined;

import {
  mainnet,
  bsc,
  polygon,
  avalanche,
  arbitrum,
  optimism,
  base,
  fantom,
  zksync,
  cronos,
  gnosis,
  celo,
  sepolia,
} from "viem/chains";
import { EVMAdapter } from "./adapter.js";

const env = (key: string, fallback: string) =>
  (typeof process !== "undefined" ? process.env[key] : undefined) ?? fallback;

function apiKey(envVar: string): { explorerApiKey: string } | Record<never, never> {
  const val = typeof process !== "undefined" ? process.env[envVar] : undefined;
  return val !== undefined ? { explorerApiKey: val } : {};
}

export function createEthereumAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: mainnet,
    walletChainId: "ethereum",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_ETH_RPC_URL", "https://rpc.ankr.com/eth"),
    explorerApiBase: "https://api.etherscan.io",
    ...apiKey("NEXT_PUBLIC_ETHERSCAN_KEY"),
  });
}

export function createBNBAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: bsc,
    walletChainId: "bnb",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_BNB_RPC_URL", "https://bsc-dataseed.binance.org"),
    explorerApiBase: "https://api.bscscan.com",
    ...apiKey("NEXT_PUBLIC_BSCSCAN_KEY"),
  });
}

export function createPolygonAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: polygon,
    walletChainId: "polygon",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_POLYGON_RPC_URL", "https://rpc.ankr.com/polygon"),
    explorerApiBase: "https://api.polygonscan.com",
    ...apiKey("NEXT_PUBLIC_POLYGONSCAN_KEY"),
  });
}

export function createAvalancheAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: avalanche,
    walletChainId: "avalanche",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_AVAX_RPC_URL", "https://api.avax.network/ext/bc/C/rpc"),
    explorerApiBase: "https://api.snowtrace.io",
    ...apiKey("NEXT_PUBLIC_SNOWTRACE_KEY"),
  });
}

export function createArbitrumAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: arbitrum,
    walletChainId: "arbitrum",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_ARB_RPC_URL", "https://arb1.arbitrum.io/rpc"),
    explorerApiBase: "https://api.arbiscan.io",
    ...apiKey("NEXT_PUBLIC_ARBISCAN_KEY"),
  });
}

export function createOptimismAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: optimism,
    walletChainId: "optimism",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_OP_RPC_URL", "https://mainnet.optimism.io"),
    explorerApiBase: "https://api-optimistic.etherscan.io",
    ...apiKey("NEXT_PUBLIC_ETHERSCAN_KEY"),
  });
}

export function createBaseAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: base,
    walletChainId: "base",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_BASE_RPC_URL", "https://mainnet.base.org"),
    explorerApiBase: "https://api.basescan.org",
    ...apiKey("NEXT_PUBLIC_BASESCAN_KEY"),
  });
}

export function createFantomAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: fantom,
    walletChainId: "fantom",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_FTM_RPC_URL", "https://rpc.ankr.com/fantom"),
    explorerApiBase: "https://api.ftmscan.com",
    ...apiKey("NEXT_PUBLIC_FTMSCAN_KEY"),
  });
}

export function createZkSyncAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: zksync,
    walletChainId: "zksync",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_ZKSYNC_RPC_URL", "https://mainnet.era.zksync.io"),
    // zkSync uses a different explorer API format; tx history not supported here
  });
}

export function createCronosAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: cronos,
    walletChainId: "cronos",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_CRO_RPC_URL", "https://evm.cronos.org"),
    explorerApiBase: "https://api.cronoscan.com",
    ...apiKey("NEXT_PUBLIC_CRONOSCAN_KEY"),
  });
}

export function createGnosisAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: gnosis,
    walletChainId: "gnosis",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_GNO_RPC_URL", "https://rpc.gnosischain.com"),
    explorerApiBase: "https://api.gnosisscan.io",
    ...apiKey("NEXT_PUBLIC_GNOSISSCAN_KEY"),
  });
}

export function createCeloAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: celo,
    walletChainId: "celo",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_CELO_RPC_URL", "https://forno.celo.org"),
    explorerApiBase: "https://api.celoscan.io",
    ...apiKey("NEXT_PUBLIC_CELOSCAN_KEY"),
  });
}

export function createSepoliaAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: sepolia,
    walletChainId: "sepolia",
    rpcUrl: rpcUrl ?? "https://rpc.sepolia.org",
    explorerApiBase: "https://api-sepolia.etherscan.io",
    ...apiKey("NEXT_PUBLIC_ETHERSCAN_KEY"),
  });
}
