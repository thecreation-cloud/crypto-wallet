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

type Step = "choice" | "create-backup" | "chains" | "import" | "password";

const CHAIN_INFO: Record<string, { icon: string; label: string; group: "Popular" | "EVM" | "Other" }> = {
  ethereum:  { icon: "⟠", label: "Ethereum",  group: "Popular" },
  bitcoin:   { icon: "₿", label: "Bitcoin",   group: "Popular" },
  solana:    { icon: "◎", label: "Solana",    group: "Popular" },
  bnb:       { icon: "◈", label: "BNB Chain", group: "EVM" },
  polygon:   { icon: "⬡", label: "Polygon",   group: "EVM" },
  avalanche: { icon: "▲", label: "Avalanche", group: "EVM" },
  arbitrum:  { icon: "◎", label: "Arbitrum",  group: "EVM" },
  optimism:  { icon: "⬤", label: "Optimism",  group: "EVM" },
  base:      { icon: "⬢", label: "Base",      group: "EVM" },
  fantom:    { icon: "✦", label: "Fantom",    group: "EVM" },
  zksync:    { icon: "⚡", label: "zkSync",    group: "EVM" },
  cronos:    { icon: "◆", label: "Cronos",    group: "EVM" },
  gnosis:    { icon: "⬟", label: "Gnosis",    group: "EVM" },
  celo:      { icon: "◉", label: "Celo",      group: "EVM" },
  litecoin:  { icon: "Ł", label: "Litecoin",  group: "Other" },
  dogecoin:  { icon: "Ð", label: "Dogecoin",  group: "Other" },
  tron:      { icon: "◈", label: "Tron",      group: "Other" },
  xrp:       { icon: "✕", label: "XRP",       group: "Other" },
  near:      { icon: "Ⓝ", label: "NEAR",      group: "Other" },
  aptos:     { icon: "⬡", label: "Aptos",     group: "Other" },
};

const DEFAULT_CHAINS = new Set(["ethereum", "bitcoin", "solana"]);
const GROUPS: Array<"Popular" | "EVM" | "Other"> = ["Popular", "EVM", "Other"];

export function WalletSetup({ onComplete, chainAdapters }: WalletSetupProps): React.JSX.Element {
  const addWallet = useWalletStore((s) => s.addWallet);
  const unlock = useWalletStore((s) => s.unlock);

  const [step, setStep] = useState<Step>("choice");
  const [preChainStep, setPreChainStep] = useState<"create-backup" | "import">("create-backup");
  const [mnemonic, setMnemonic] = useState("");
  const [importInput, setImportInput] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [walletName, setWalletName] = useState("My Wallet");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedPhrase, setCopiedPhrase] = useState(false);
  const [selectedChainIds, setSelectedChainIds] = useState<Set<string>>(new Set(DEFAULT_CHAINS));

  function toggleChain(chainId: string) {
    setSelectedChainIds((prev) => {
      const next = new Set(prev);
      if (next.has(chainId)) {
        if (next.size > 1) next.delete(chainId);
      } else {
        next.add(chainId);
      }
      return next;
    });
  }

  function goToChains(from: "create-backup" | "import") {
    setPreChainStep(from);
    setStep("chains");
  }

  function handleCreate() {
    setMnemonic(generateMnemonic(128));
    setStep("create-backup");
  }

  async function handleCopyPhrase() {
    await navigator.clipboard.writeText(mnemonic);
    setCopiedPhrase(true);
    setTimeout(() => setCopiedPhrase(false), 2000);
  }

  async function handleFinish() {
    setError("");
    if (!validateMnemonic(mnemonic)) {
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
      const seed = mnemonicToSeed(mnemonic);
      const encryptedMnemonic = await encrypt(mnemonic, password);
      const walletId = crypto.randomUUID();

      const selectedAdapters = chainAdapters.filter((a) => selectedChainIds.has(a.chainId));
      const accounts: WalletAccount[] = selectedAdapters.map((adapter) => {
        const path = adapter.derivationPath(0);
        const derived = adapter.isEd25519 ? deriveEd25519Key(seed, path) : deriveKey(seed, path);
        const name = adapter.chainId.charAt(0).toUpperCase() + adapter.chainId.slice(1).replace(/-/g, " ");
        return {
          id: crypto.randomUUID(),
          name,
          chainId: adapter.chainId,
          address: adapter.deriveAddress(derived.publicKey),
          publicKey: Array.from(derived.publicKey).map((b) => b.toString(16).padStart(2, "0")).join(""),
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
              onClick={() => goToChains("create-backup")}
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
              goToChains("import");
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

  if (step === "chains") {
    return (
      <div className="flex flex-col min-h-screen bg-gray-950">
        <div className="w-full max-w-md mx-auto px-6 pt-8 pb-6 flex flex-col" style={{ minHeight: "100dvh" }}>
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-white">Choose Your Networks</h2>
            <p className="text-gray-400 mt-1 text-sm">
              Select the chains you want to use. Start small — Ethereum, Bitcoin and Solana cover most needs.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-5 pb-2">
            {GROUPS.map((group) => {
              const groupChains = chainAdapters.filter(
                (a) => (CHAIN_INFO[a.chainId]?.group ?? "Other") === group,
              );
              if (groupChains.length === 0) return null;
              return (
                <div key={group}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{group}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {groupChains.map((adapter) => {
                      const info = CHAIN_INFO[adapter.chainId];
                      const selected = selectedChainIds.has(adapter.chainId);
                      return (
                        <button
                          key={adapter.chainId}
                          onClick={() => toggleChain(adapter.chainId)}
                          className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm font-medium transition-all ${
                            selected
                              ? "bg-indigo-600/20 border-indigo-500 text-white"
                              : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                          }`}
                        >
                          {selected && (
                            <span className="absolute top-1.5 right-1.5 text-indigo-400 text-xs leading-none">✓</span>
                          )}
                          <span className="text-xl leading-none">{info?.icon ?? "●"}</span>
                          <span className="text-xs leading-tight text-center">{info?.label ?? adapter.chainId}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2 pt-4">
            <button
              onClick={() => setStep("password")}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
            >
              Continue with {selectedChainIds.size} chain{selectedChainIds.size !== 1 ? "s" : ""} →
            </button>
            <button
              onClick={() => setStep(preChainStep)}
              className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors"
            >
              ← Back
            </button>
          </div>
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
          onClick={handleFinish}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
        >
          {loading ? "Creating wallet..." : "Create Wallet"}
        </button>
        <button onClick={() => setStep("chains")} className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors">
          ← Back
        </button>
      </div>
    </div>
  );
}
