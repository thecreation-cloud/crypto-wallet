"use client";

import React, { useState } from "react";
import { generateMnemonic, validateMnemonic, mnemonicToSeed, encrypt, deriveKey, deriveEd25519Key } from "@wallet/core";
import { useWalletStore } from "@wallet/store";
import type { StoredWallet, WalletAccount } from "@wallet/core";

interface ChainAdapterSetupConfig {
  chainId: string;
  deriveAddress: (pub: Uint8Array) => string;
  derivationPath: (i?: number) => string;
  isEd25519?: boolean;
}

interface WalletSetupProps {
  onComplete?: () => void;
  chainAdapters: ChainAdapterSetupConfig[];
}

type Step = "choice" | "create-backup" | "create-confirm" | "import" | "password";

export function WalletSetup({ onComplete, chainAdapters }: WalletSetupProps) {
  const addWallet = useWalletStore((s) => s.addWallet);
  const unlock = useWalletStore((s) => s.unlock);

  const [step, setStep] = useState<Step>("choice");
  const [mnemonic, setMnemonic] = useState("");
  const [importInput, setImportInput] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [walletName, setWalletName] = useState("My Wallet");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedPhrase, setCopiedPhrase] = useState(false);

  function handleCreate() {
    setMnemonic(generateMnemonic(128));
    setStep("create-backup");
  }

  async function handleCopyPhrase() {
    await navigator.clipboard.writeText(mnemonic);
    setCopiedPhrase(true);
    setTimeout(() => setCopiedPhrase(false), 2000);
  }

  async function handleFinish(finalMnemonic: string) {
    setError("");
    if (!validateMnemonic(finalMnemonic)) {
      setError("Invalid recovery phrase. Please check every word.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const seed = mnemonicToSeed(finalMnemonic);
      const encryptedMnemonic = await encrypt(finalMnemonic, password);
      const walletId = crypto.randomUUID();

      const accounts: WalletAccount[] = chainAdapters.map((adapter) => {
        const path = adapter.derivationPath(0);
        const derived = adapter.isEd25519 ? deriveEd25519Key(seed, path) : deriveKey(seed, path);
        const name = adapter.chainId.charAt(0).toUpperCase() + adapter.chainId.slice(1).replace(/-/g, " ");
        return {
          id: crypto.randomUUID(),
          name,
          chainId: adapter.chainId,
          address: adapter.deriveAddress(derived.publicKey),
          publicKey: Buffer.from(derived.publicKey).toString("hex"),
          derivationPath: path,
          accountIndex: 0,
        };
      });

      const wallet: StoredWallet = {
        id: walletId,
        name: walletName,
        encryptedMnemonic: JSON.stringify(encryptedMnemonic),
        accounts,
        createdAt: Date.now(),
      };

      addWallet(wallet);
      unlock(walletId, seed);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (step === "choice") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="space-y-2">
            <div className="text-5xl mb-4">🔐</div>
            <h1 className="text-3xl font-bold text-white">Crypto Wallet</h1>
            <p className="text-gray-400">Your keys, your coins.</p>
          </div>
          <div className="space-y-3 pt-4">
            <button
              onClick={handleCreate}
              className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
            >
              Create New Wallet
            </button>
            <button
              onClick={() => setStep("import")}
              className="w-full py-3 px-6 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors border border-gray-700"
            >
              Import with Recovery Phrase
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "create-backup") {
    const words = mnemonic.split(" ");
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 p-6">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Back Up Recovery Phrase</h2>
            <p className="text-gray-400 mt-1 text-sm">
              Write these 12 words in order and store them somewhere safe. Never share them with anyone.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 p-4 bg-gray-900 rounded-xl border border-gray-700">
            {words.map((word, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sm">
                <span className="text-gray-500 w-5 text-right">{i + 1}.</span>
                <span className="text-white font-mono">{word}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCopyPhrase}
              className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm transition-colors border border-gray-700"
            >
              {copiedPhrase ? "Copied!" : "Copy Phrase"}
            </button>
            <button
              onClick={() => setStep("password")}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              I've Saved It →
            </button>
          </div>
          <button onClick={() => setStep("choice")} className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (step === "import") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 p-6">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Import Wallet</h2>
            <p className="text-gray-400 mt-1 text-sm">Enter your 12 or 24-word recovery phrase, separated by spaces.</p>
          </div>
          <textarea
            value={importInput}
            onChange={(e) => setImportInput(e.target.value)}
            placeholder="word1 word2 word3 ..."
            rows={4}
            className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700 focus:border-indigo-500 focus:outline-none font-mono text-sm resize-none"
          />
          <button
            disabled={!importInput.trim()}
            onClick={() => {
              setMnemonic(importInput.trim().toLowerCase());
              setStep("password");
            }}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
          >
            Continue →
          </button>
          <button onClick={() => setStep("choice")} className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 p-6">
      <div className="w-full max-w-md space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-white">Protect Your Wallet</h2>
          <p className="text-gray-400 mt-1 text-sm">This password encrypts your wallet on this device.</p>
        </div>
        <div className="space-y-3">
          <input
            value={walletName}
            onChange={(e) => setWalletName(e.target.value)}
            placeholder="Wallet name"
            className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700 focus:border-indigo-500 focus:outline-none text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700 focus:border-indigo-500 focus:outline-none text-sm"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700 focus:border-indigo-500 focus:outline-none text-sm"
          />
        </div>
        {error && <p className="text-red-400 text-sm bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
        <button
          disabled={loading}
          onClick={() => handleFinish(mnemonic)}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
        >
          {loading ? "Creating wallet..." : "Create Wallet"}
        </button>
        <button onClick={() => setStep("choice")} className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors">
          ← Back
        </button>
      </div>
    </div>
  );
}
