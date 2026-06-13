"use client";

import React, { useEffect, useRef, useState } from "react";
import { useWalletStore } from "@wallet/store";
import { ChainCard } from "./ChainCard.js";
import { SendModal } from "./SendModal.js";
import { ReceiveModal } from "./ReceiveModal.js";
import { TransactionList } from "./TransactionList.js";
import { NetworksModal } from "./NetworksModal.js";
import type { WalletAccount } from "@wallet/core";

export function Dashboard(): React.JSX.Element | null {
  const wallet = useWalletStore((s) => s.getActiveWallet());
  const accounts = useWalletStore((s) => s.getActiveAccounts());
  const hiddenChainIds = useWalletStore(
    (s) => s.activeWalletId ? (s.hiddenChainsByWallet[s.activeWalletId] ?? []) : [],
  );
  const refreshBalance = useWalletStore((s) => s.refreshBalance);
  const isUnlocked = useWalletStore((s) => s.isUnlocked());
  const lock = useWalletStore((s) => s.lock);

  const visibleAccounts = accounts.filter((a) => !hiddenChainIds.includes(a.chainId));

  const [sendAccount, setSendAccount] = useState<WalletAccount | null>(null);
  const [receiveAccount, setReceiveAccount] = useState<WalletAccount | null>(null);
  const [activeTab, setActiveTab] = useState<string>(visibleAccounts[0]?.chainId ?? "");
  const [refreshing, setRefreshing] = useState(false);
  const [showNetworks, setShowNetworks] = useState(false);
  const loadedTabs = useRef<Set<string>>(new Set());

  // If active tab gets hidden, switch to first visible chain
  useEffect(() => {
    if (activeTab && hiddenChainIds.includes(activeTab)) {
      setActiveTab(visibleAccounts[0]?.chainId ?? "");
    }
  }, [hiddenChainIds]);

  // Seed the active tab when accounts first load
  useEffect(() => {
    if (visibleAccounts.length > 0 && !activeTab) {
      setActiveTab(visibleAccounts[0]!.chainId);
    }
  }, [visibleAccounts.length]);

  const activeAccount = visibleAccounts.find((a) => a.chainId === activeTab) ?? null;

  // Load balance lazily when active tab changes
  useEffect(() => {
    if (!activeAccount) return;
    void (async () => {
      await refreshBalance(activeAccount);
      loadedTabs.current.add(activeAccount.chainId);
    })();
  }, [activeAccount?.id]);

  async function handleRefresh() {
    if (!activeAccount) return;
    setRefreshing(true);
    try {
      await refreshBalance(activeAccount);
    } finally {
      setRefreshing(false);
    }
  }

  if (!wallet) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-white">{wallet.name}</h1>
          <p className="text-gray-500 text-xs">{isUnlocked ? "Unlocked" : "Locked"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNetworks(true)}
            className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors border border-gray-700"
            title="Manage networks"
          >
            Networks
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-40"
            title="Refresh balance"
          >
            {refreshing ? "⟳" : "↻"}
          </button>
          {isUnlocked && (
            <button
              onClick={lock}
              className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors border border-gray-700"
            >
              Lock
            </button>
          )}
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {activeAccount && (
          <ChainCard
            account={activeAccount}
            onSend={setSendAccount}
            onReceive={setReceiveAccount}
          />
        )}

        {visibleAccounts.length > 1 && (
          <div>
            <div className="overflow-x-auto">
              <div className="flex gap-1 mb-4 bg-gray-900 p-1 rounded-xl min-w-max">
                {visibleAccounts.map((account) => (
                  <button
                    key={account.chainId}
                    onClick={() => setActiveTab(account.chainId)}
                    className={`flex-shrink-0 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                      activeTab === account.chainId
                        ? "bg-gray-700 text-white"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {account.name}
                  </button>
                ))}
              </div>
            </div>

            {activeAccount && (
              <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
                <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-3">
                  Transaction History
                </h3>
                <TransactionList account={activeAccount} />
              </div>
            )}
          </div>
        )}

        {visibleAccounts.length === 1 && activeAccount && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
            <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-3">
              Transaction History
            </h3>
            <TransactionList account={activeAccount} />
          </div>
        )}
      </div>

      {sendAccount && <SendModal account={sendAccount} onClose={() => setSendAccount(null)} />}
      {receiveAccount && <ReceiveModal account={receiveAccount} onClose={() => setReceiveAccount(null)} />}
      {showNetworks && <NetworksModal onClose={() => setShowNetworks(false)} />}
    </div>
  );
}
