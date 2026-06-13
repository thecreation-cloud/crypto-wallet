"use client";

import React from "react";
import { useWalletStore } from "@wallet/store";
import type { WalletAccount, Transaction } from "@wallet/core";

interface TransactionListProps {
  account: WalletAccount;
}

function formatBalance(value: bigint, decimals: number): string {
  if (value === 0n) return "0";
  const divisor = BigInt(10 ** decimals);
  const whole = value / divisor;
  const frac = (value % divisor).toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

function formatTimestamp(ts: number): string {
  if (!ts) return "Unknown";
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function TxRow({ tx, decimals, symbol, explorerUrl }: {
  tx: Transaction;
  decimals: number;
  symbol: string;
  explorerUrl?: string;
}) {
  const isIn = tx.direction === "in";
  const statusColor = tx.status === "confirmed" ? "text-green-400" : tx.status === "pending" ? "text-yellow-400" : "text-red-400";

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${isIn ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
          {isIn ? "↓" : "↑"}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium">{isIn ? "Received" : "Sent"}</span>
            <span className={`text-xs ${statusColor}`}>{tx.status}</span>
          </div>
          <div className="text-gray-500 text-xs">
            {formatTimestamp(tx.timestamp)}
            {explorerUrl && (
              <>
                {" · "}
                <a
                  href={`${explorerUrl}/tx/${tx.hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  {truncateHash(tx.hash)}
                </a>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${isIn ? "text-green-400" : "text-gray-200"}`}>
          {isIn ? "+" : "-"}{formatBalance(tx.value, decimals)} {tx.tokenSymbol ?? symbol}
        </p>
        {tx.fee > 0n && (
          <p className="text-xs text-gray-500">fee: {formatBalance(tx.fee, decimals)} {symbol}</p>
        )}
      </div>
    </div>
  );
}

export function TransactionList({ account }: TransactionListProps): React.JSX.Element {
  const txs = useWalletStore((s) => s.getTransactions(account.chainId, account.address));
  const adapter = useWalletStore((s) => s.getAdapter(account.chainId));

  const symbol = adapter?.symbol ?? account.chainId.toUpperCase();
  const decimals = adapter?.decimals ?? 18;
  const explorerUrl = adapter?.explorerUrl;

  if (txs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        <p className="text-3xl mb-2">📭</p>
        <p className="text-sm">No transactions yet</p>
      </div>
    );
  }

  return (
    <div>
      {txs.map((tx) => (
        <TxRow
          key={tx.hash}
          tx={tx}
          decimals={decimals}
          symbol={symbol}
          explorerUrl={explorerUrl}
        />
      ))}
    </div>
  );
}
