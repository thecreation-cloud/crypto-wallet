"use client";

import React, { useState } from "react";
import { decrypt, mnemonicToSeed } from "@wallet/core";
import { useWalletStore } from "@wallet/store";
import type { EncryptedPayload } from "@wallet/core";

export function UnlockScreen(): React.JSX.Element {
  const wallets = useWalletStore((s) => s.wallets);
  const removeWallet = useWalletStore((s) => s.removeWallet);
  const unlock = useWalletStore((s) => s.unlock);
  const activeWalletId = useWalletStore((s) => s.activeWalletId);

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const wallet = wallets.find((w) => w.id === activeWalletId) ?? wallets[0];

  async function handleUnlock() {
    if (!wallet) return;
    setError("");
    setLoading(true);
    try {
      const payload = JSON.parse(wallet.encryptedMnemonic) as EncryptedPayload;
      const mnemonic = await decrypt(payload, password);
      const seed = mnemonicToSeed(mnemonic);
      unlock(wallet.id, seed);
    } catch {
      setError("Incorrect password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleRestoreConfirmed() {
    // Remove all wallets — WalletApp will show WalletSetup once wallets is empty
    wallets.forEach((w) => removeWallet(w.id));
  }

  if (confirmRestore) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 p-6">
        <div className="w-full max-w-sm space-y-5">
          <div className="text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-xl font-bold text-white">Restore from Recovery Phrase?</h2>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">
              This will remove <span className="text-white font-medium">{wallet?.name ?? "your wallet"}</span> from
              this device. Make sure you have your 12-word recovery phrase before continuing — without it,
              your funds cannot be recovered.
            </p>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-3">
            <p className="text-yellow-400 text-xs text-center">
              Your funds are safe as long as you have your recovery phrase.
            </p>
          </div>
          <div className="space-y-2">
            <button
              onClick={handleRestoreConfirmed}
              className="w-full py-3 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              Yes, remove wallet and restore
            </button>
            <button
              onClick={() => setConfirmRestore(false)}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors text-sm border border-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-5xl mb-3">🔐</div>
          <h2 className="text-2xl font-bold text-white">{wallet?.name ?? "Wallet"}</h2>
          <p className="text-gray-400 text-sm mt-1">Enter your password to unlock</p>
          <p className="text-gray-600 text-xs mt-1">Saved on this device · password decrypts your wallet</p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            placeholder="Password"
            className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700 focus:border-indigo-500 focus:outline-none text-sm text-center"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            disabled={!password || loading}
            onClick={handleUnlock}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? "Unlocking..." : "Unlock"}
          </button>
        </div>

        <div className="text-center">
          <button
            onClick={() => setConfirmRestore(true)}
            className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
          >
            Forgot password? Restore with recovery phrase →
          </button>
        </div>
      </div>
    </div>
  );
}
