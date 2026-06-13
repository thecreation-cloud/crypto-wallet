"use client";

import React, { useEffect, useState } from "react";
import { useWalletStore } from "@wallet/store";
import { ChainCard } from "./ChainCard.js";
import { SendModal } from "./SendModal.js";
import { ReceiveModal } from "./ReceiveModal.js";
import { TransactionList } from "./TransactionList.js";
import type { WalletAccount } from "@wallet/core";

export function Dashboard(): React.JSX.Element | null {
  const wallet = useWalletStore((s) => s.getActiveWallet());
  const accounts = useWalletStore((s) => s.getActiveAccounts());
  const refreshAll = useWalletStore((s) => s.refreshAllBalances);
  const isUnlocked = useWalletStore((s) => s.isUnlocked());
  const lock = useWalletStore((s) => s.lock);

  const [sendAccount, setSendAccount] = useState<WalletAccount | null>(null);
  const [receiveAccount, setReceiveAccount] = useState<WalletAccount | null>(null);
  const [activeTab, setActiveTab] = useState<string>(accounts[0]?.chainId ?? "");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (accounts.length > 0 && !activeTab) setActiveTab(accounts[0]!.chainId);
  }, [accounts]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void handleRefresh();
  }, [wallet?.id]);

  const activeAccount = accounts.find((a) => a.chainId === activeTab);

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
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-40"
            title="Refresh balances"
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
        <div className="grid gap-3">
          {accounts.map((account) => (
            <ChainCard
              key={account.id}
              account={account}
              onSend={setSendAccount}
              onReceive={setReceiveAccount}
            />
          ))}
        </div>

        <div>
          <div className="flex gap-1 mb-4 bg-gray-900 p-1 rounded-xl">
            {accounts.map((account) => (
              <button
                key={account.chainId}
                onClick={() => setActiveTab(account.chainId)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === account.chainId
                    ? "bg-gray-700 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {account.name}
              </button>
            ))}
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
      </div>

      {sendAccount && <SendModal account={sendAccount} onClose={() => setSendAccount(null)} />}
      {receiveAccount && <ReceiveModal account={receiveAccount} onClose={() => setReceiveAccount(null)} />}
    </div>
  );
}
