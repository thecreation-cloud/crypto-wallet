"use client";

import React, { useState } from "react";
import { decrypt, mnemonicToSeed } from "@wallet/core";
import { useWalletStore } from "@wallet/store";
import type { EncryptedPayload } from "@wallet/core";

export function UnlockScreen(): React.JSX.Element {
  const wallets = useWalletStore((s) => s.wallets);
  const unlock = useWalletStore((s) => s.unlock);
  const activeWalletId = useWalletStore((s) => s.activeWalletId);

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      setError("Incorrect password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <div className="text-5xl mb-3">🔐</div>
          <h2 className="text-2xl font-bold text-white">{wallet?.name ?? "Wallet"}</h2>
          <p className="text-gray-400 text-sm mt-1">Enter your password to unlock</p>
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
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            disabled={!password || loading}
            onClick={handleUnlock}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? "Unlocking..." : "Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}
