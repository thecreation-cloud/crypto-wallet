import {
  createEthereumAdapter,
  createBNBAdapter,
  createPolygonAdapter,
  createAvalancheAdapter,
  createArbitrumAdapter,
  createOptimismAdapter,
  createBaseAdapter,
  createFantomAdapter,
  createZkSyncAdapter,
  createCronosAdapter,
  createGnosisAdapter,
  createCeloAdapter,
} from "@wallet/chain-ethereum";
import { createBitcoinAdapter, createLitecoinAdapter, createDogecoinAdapter } from "@wallet/chain-bitcoin";
import { createSolanaAdapter } from "@wallet/chain-solana";
import { createTronAdapter } from "@wallet/chain-tron";
import { createXRPAdapter } from "@wallet/chain-xrp";
import { createNEARAdapter } from "@wallet/chain-near";
import { createAptosAdapter } from "@wallet/chain-aptos";
import type { ChainAdapter } from "@wallet/core";

const e = (key: string) => (typeof process !== "undefined" ? process.env[key] : undefined);

// All EVM chains route tx history through the server-side proxy to avoid browser CORS blocks
const evmOverride = { txProxyUrl: "/api/txlist" };

export const adapters: ChainAdapter[] = [
  createEthereumAdapter(e("NEXT_PUBLIC_ETH_RPC_URL"), evmOverride),
  createBNBAdapter(e("NEXT_PUBLIC_BNB_RPC_URL"), evmOverride),
  createPolygonAdapter(e("NEXT_PUBLIC_POLYGON_RPC_URL"), evmOverride),
  createAvalancheAdapter(e("NEXT_PUBLIC_AVAX_RPC_URL"), evmOverride),
  createArbitrumAdapter(e("NEXT_PUBLIC_ARB_RPC_URL"), evmOverride),
  createOptimismAdapter(e("NEXT_PUBLIC_OP_RPC_URL"), evmOverride),
  createBaseAdapter(e("NEXT_PUBLIC_BASE_RPC_URL"), evmOverride),
  createFantomAdapter(e("NEXT_PUBLIC_FTM_RPC_URL"), evmOverride),
  createZkSyncAdapter(e("NEXT_PUBLIC_ZKSYNC_RPC_URL"), evmOverride),
  createCronosAdapter(e("NEXT_PUBLIC_CRO_RPC_URL"), evmOverride),
  createGnosisAdapter(e("NEXT_PUBLIC_GNO_RPC_URL"), evmOverride),
  createCeloAdapter(e("NEXT_PUBLIC_CELO_RPC_URL"), evmOverride),
  createBitcoinAdapter(),
  createLitecoinAdapter(),
  createDogecoinAdapter(),
  createSolanaAdapter(e("NEXT_PUBLIC_SOL_RPC_URL") ?? "https://api.mainnet-beta.solana.com"),
  createTronAdapter(e("NEXT_PUBLIC_TRON_API_KEY")),
  createXRPAdapter(e("NEXT_PUBLIC_XRP_RPC_URL")),
  createNEARAdapter(e("NEXT_PUBLIC_NEAR_RPC_URL")),
  createAptosAdapter(),
];

export const adapterMap = new Map(adapters.map((a) => [a.chainId, a]));
