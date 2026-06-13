import "../polyfills";
import {
  createEthereumAdapter,
  createBNBAdapter,
  createPolygonAdapter,
  createArbitrumAdapter,
  createOptimismAdapter,
  createBaseAdapter,
} from "@wallet/chain-ethereum";
import { createBitcoinAdapter } from "@wallet/chain-bitcoin";
import { createSolanaAdapter } from "@wallet/chain-solana";
import { createTronAdapter } from "@wallet/chain-tron";
import { createXRPAdapter } from "@wallet/chain-xrp";
import type { ChainAdapter } from "@wallet/core";

export const adapters: ChainAdapter[] = [
  createEthereumAdapter(),
  createBNBAdapter(),
  createPolygonAdapter(),
  createArbitrumAdapter(),
  createOptimismAdapter(),
  createBaseAdapter(),
  createBitcoinAdapter(),
  createSolanaAdapter("https://api.mainnet-beta.solana.com"),
  createTronAdapter(),
  createXRPAdapter(),
];
