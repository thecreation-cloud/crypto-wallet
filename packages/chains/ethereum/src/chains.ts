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

export function createEthereumAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: mainnet,
    walletChainId: "ethereum",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_ETH_RPC_URL", "https://cloudflare-eth.com"),
  });
}

export function createBNBAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: bsc,
    walletChainId: "bnb",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_BNB_RPC_URL", "https://bsc-dataseed.binance.org"),
  });
}

export function createPolygonAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: polygon,
    walletChainId: "polygon",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_POLYGON_RPC_URL", "https://polygon-rpc.com"),
  });
}

export function createAvalancheAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: avalanche,
    walletChainId: "avalanche",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_AVAX_RPC_URL", "https://api.avax.network/ext/bc/C/rpc"),
  });
}

export function createArbitrumAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: arbitrum,
    walletChainId: "arbitrum",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_ARB_RPC_URL", "https://arb1.arbitrum.io/rpc"),
  });
}

export function createOptimismAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: optimism,
    walletChainId: "optimism",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_OP_RPC_URL", "https://mainnet.optimism.io"),
  });
}

export function createBaseAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: base,
    walletChainId: "base",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_BASE_RPC_URL", "https://mainnet.base.org"),
  });
}

export function createFantomAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: fantom,
    walletChainId: "fantom",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_FTM_RPC_URL", "https://rpc.ftm.tools"),
  });
}

export function createZkSyncAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: zksync,
    walletChainId: "zksync",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_ZKSYNC_RPC_URL", "https://mainnet.era.zksync.io"),
  });
}

export function createCronosAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: cronos,
    walletChainId: "cronos",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_CRO_RPC_URL", "https://evm.cronos.org"),
  });
}

export function createGnosisAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: gnosis,
    walletChainId: "gnosis",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_GNO_RPC_URL", "https://rpc.gnosischain.com"),
  });
}

export function createCeloAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: celo,
    walletChainId: "celo",
    rpcUrl: rpcUrl ?? env("NEXT_PUBLIC_CELO_RPC_URL", "https://forno.celo.org"),
  });
}

export function createSepoliaAdapter(rpcUrl?: string): EVMAdapter {
  return new EVMAdapter({
    chain: sepolia,
    walletChainId: "sepolia",
    rpcUrl: rpcUrl ?? "https://rpc.sepolia.org",
  });
}
