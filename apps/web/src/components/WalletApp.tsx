"use client";

import { useState } from "react";
import { useWalletStore } from "@wallet/store";
import { Dashboard, WalletSetup, UnlockScreen } from "@wallet/ui";
import { adapters } from "@/lib/adapters";
import { CloudBackupPrompt } from "./CloudBackupPrompt";
import { CloudRestoreScreen } from "./CloudRestoreScreen";

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
  const hasHydrated = useWalletStore((s) => s._hasHydrated);

  const [showCloudBackup, setShowCloudBackup] = useState(false);
  const [showCloudRestore, setShowCloudRestore] = useState(false);

  // Wait for localStorage to hydrate before deciding which screen to show
  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading wallet…</p>
        </div>
      </div>
    );
  }

  if (showCloudRestore) {
    return <CloudRestoreScreen onBack={() => setShowCloudRestore(false)} />;
  }

  if (wallets.length === 0) {
    return (
      <WalletSetup
        chainAdapters={chainAdapterSetupProps}
        onComplete={() => setShowCloudBackup(true)}
        onCloudRestore={() => setShowCloudRestore(true)}
      />
    );
  }

  if (!isUnlocked) {
    return <UnlockScreen />;
  }

  if (showCloudBackup) {
    return <CloudBackupPrompt onDone={() => setShowCloudBackup(false)} />;
  }

  return <Dashboard />;
}
