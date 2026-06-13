"use client";

import { useState, useEffect } from "react";
import { useWalletStore } from "@wallet/store";
import { Dashboard, WalletSetup, UnlockScreen } from "@wallet/ui";
import { adapters } from "@/lib/adapters";
import { CloudBackupPrompt } from "./CloudBackupPrompt";
import { CloudRestoreScreen } from "./CloudRestoreScreen";
import { getSession, saveWalletToCloud, loadWalletsFromCloud } from "@/lib/walletCloud";
import { isSupabaseConfigured } from "@/lib/supabase";

const ED25519_CHAINS = new Set(["solana", "near", "aptos"]);

const chainAdapterSetupProps = adapters.map((a) => ({
  chainId: a.chainId,
  deriveAddress: (pub: Uint8Array) => a.deriveAddress(pub),
  derivationPath: (i?: number) => a.derivationPath(i),
  isEd25519: ED25519_CHAINS.has(a.chainId),
}));

export function WalletApp(): JSX.Element {
  const wallets = useWalletStore((s) => s.wallets);
  const addWallet = useWalletStore((s) => s.addWallet);
  const getActiveWallet = useWalletStore((s) => s.getActiveWallet);
  const isUnlocked = useWalletStore((s) => s.isUnlocked());
  const hasHydrated = useWalletStore((s) => s._hasHydrated);

  const [showCloudBackup, setShowCloudBackup] = useState(false);
  const [showCloudRestore, setShowCloudRestore] = useState(false);
  const [cloudBanner, setCloudBanner] = useState<"synced" | "restored" | "error" | null>(null);

  // After hydration, check if we need to handle a pending cloud action
  // (user clicked the magic link email and was redirected back here)
  useEffect(() => {
    if (!hasHydrated || !isSupabaseConfigured()) return;

    const action = localStorage.getItem("pending_cloud_action");
    if (!action) return;

    getSession().then((session) => {
      if (!session) return;

      if (action === "restore" && wallets.length === 0) {
        localStorage.removeItem("pending_cloud_action");
        loadWalletsFromCloud()
          .then((cloudWallets) => {
            cloudWallets.forEach((w) => addWallet(w));
            setCloudBanner(cloudWallets.length > 0 ? "restored" : null);
          })
          .catch(() => setCloudBanner("error"));
      }

      if (action === "backup" && wallets.length > 0 && isUnlocked) {
        localStorage.removeItem("pending_cloud_action");
        const wallet = getActiveWallet();
        if (wallet) {
          saveWalletToCloud(wallet)
            .then(() => setCloudBanner("synced"))
            .catch(() => setCloudBanner("error"));
        }
      }
    });
  }, [hasHydrated, isUnlocked]);

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

  return (
    <>
      {cloudBanner && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg border transition-all ${
            cloudBanner === "synced"
              ? "bg-green-950 border-green-700 text-green-300"
              : cloudBanner === "restored"
                ? "bg-indigo-950 border-indigo-700 text-indigo-300"
                : "bg-red-950 border-red-700 text-red-300"
          }`}
          onClick={() => setCloudBanner(null)}
        >
          {cloudBanner === "synced" && "☁ Wallet backed up to cloud ✓"}
          {cloudBanner === "restored" && "☁ Wallet restored from cloud ✓"}
          {cloudBanner === "error" && "Cloud sync failed — try again later"}
        </div>
      )}
      <Dashboard />
    </>
  );
}
