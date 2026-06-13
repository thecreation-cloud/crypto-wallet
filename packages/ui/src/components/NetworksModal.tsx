"use client";

import React from "react";
import { useWalletStore } from "@wallet/store";

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

const GROUPS: Array<"Popular" | "EVM" | "Other"> = ["Popular", "EVM", "Other"];

interface NetworksModalProps {
  onClose: () => void;
}

export function NetworksModal({ onClose }: NetworksModalProps): React.JSX.Element {
  const accounts = useWalletStore((s) => s.getActiveAccounts());
  const hiddenChainIds = useWalletStore((s) => s.hiddenChainIds);
  const setChainVisibility = useWalletStore((s) => s.setChainVisibility);

  const visibleCount = accounts.filter((a) => !hiddenChainIds.includes(a.chainId)).length;

  function toggle(chainId: string) {
    const isVisible = !hiddenChainIds.includes(chainId);
    // Must keep at least one chain visible
    if (isVisible && visibleCount <= 1) return;
    setChainVisibility(chainId, !isVisible);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-800 flex flex-col max-h-[85dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">Manage Networks</h2>
            <p className="text-gray-500 text-xs mt-0.5">{visibleCount} of {accounts.length} active</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-2xl leading-none w-8 h-8 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Chain list */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {GROUPS.map((group) => {
            const groupAccounts = accounts.filter(
              (a) => (CHAIN_INFO[a.chainId]?.group ?? "Other") === group,
            );
            if (groupAccounts.length === 0) return null;
            return (
              <div key={group}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{group}</p>
                <div className="grid grid-cols-3 gap-2">
                  {groupAccounts.map((account) => {
                    const info = CHAIN_INFO[account.chainId];
                    const visible = !hiddenChainIds.includes(account.chainId);
                    const isLast = visible && visibleCount <= 1;
                    return (
                      <button
                        key={account.chainId}
                        onClick={() => toggle(account.chainId)}
                        disabled={isLast}
                        title={isLast ? "At least one network must be active" : undefined}
                        className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm font-medium transition-all ${
                          visible
                            ? "bg-indigo-600/20 border-indigo-500 text-white"
                            : "bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
                        } ${isLast ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {visible && (
                          <span className="absolute top-1.5 right-1.5 text-indigo-400 text-xs leading-none">✓</span>
                        )}
                        <span className="text-xl leading-none">{info?.icon ?? "●"}</span>
                        <span className="text-xs leading-tight text-center">{info?.label ?? account.chainId}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-800">
          <button
            onClick={onClose}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
