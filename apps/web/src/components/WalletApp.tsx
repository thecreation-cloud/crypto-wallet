"use client";

import { useWalletStore } from "@wallet/store";
import { Dashboard, WalletSetup, UnlockScreen } from "@wallet/ui";
import { deriveKey, deriveEd25519Key } from "@wallet/core";
import { adapters } from "@/lib/adapters";

const ED25519_CHAINS = new Set(["solana", "near", "aptos"]);

const chainAdapterSetupProps = adapters.map((a) => ({
  chainId: a.chainId,
  deriveAddress: (pub: Uint8Array) => a.deriveAddress(pub),
  derivationPath: (i?: number) => a.derivationPath(i),
  isEd25519: ED25519_CHAINS.has(a.chainId),
}));

export function WalletApp(): JSX.Element {
  const wallets = useWalletStore((s) => s.wallets);
  const isUnlocked = useWalletStore((s) => s.isUnlocked());

  if (wallets.length === 0) {
    return <WalletSetup chainAdapters={chainAdapterSetupProps} />;
  }

  if (!isUnlocked) {
    return <UnlockScreen />;
  }

  return <Dashboard />;
}
