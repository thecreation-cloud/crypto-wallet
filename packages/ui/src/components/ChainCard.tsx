"use client";

import React from "react";
import { useWalletStore } from "@wallet/store";
import type { WalletAccount } from "@wallet/core";

const CHAIN_ICONS: Record<string, string> = {
  ethereum: "⟠",
  bnb: "◈",
  polygon: "⬡",
  avalanche: "▲",
  arbitrum: "◎",
  optimism: "⬤",
  base: "⬢",
  fantom: "✦",
  zksync: "⚡",
  cronos: "◆",
  gnosis: "⬟",
  celo: "◉",
  bitcoin: "₿",
  litecoin: "Ł",
  dogecoin: "Ð",
  solana: "◎",
  tron: "◈",
  xrp: "✕",
  near: "Ⓝ",
  aptos: "⬡",
};

const CHAIN_COLORS: Record<string, string> = {
  ethereum: "from-indigo-900/40 to-indigo-800/20 border-indigo-700/40",
  bnb: "from-yellow-900/40 to-yellow-800/20 border-yellow-700/40",
  polygon: "from-violet-900/40 to-violet-800/20 border-violet-700/40",
  avalanche: "from-red-900/40 to-red-800/20 border-red-700/40",
  arbitrum: "from-sky-900/40 to-sky-800/20 border-sky-700/40",
  optimism: "from-rose-900/40 to-rose-800/20 border-rose-700/40",
  base: "from-blue-900/40 to-blue-800/20 border-blue-700/40",
  fantom: "from-cyan-900/40 to-cyan-800/20 border-cyan-700/40",
  zksync: "from-fuchsia-900/40 to-fuchsia-800/20 border-fuchsia-700/40",
  cronos: "from-indigo-900/40 to-indigo-800/20 border-indigo-600/40",
  gnosis: "from-emerald-900/40 to-emerald-800/20 border-emerald-700/40",
  celo: "from-lime-900/40 to-lime-800/20 border-lime-700/40",
  bitcoin: "from-orange-900/40 to-orange-800/20 border-orange-700/40",
  litecoin: "from-slate-700/40 to-slate-600/20 border-slate-500/40",
  dogecoin: "from-yellow-800/40 to-yellow-700/20 border-yellow-600/40",
  solana: "from-purple-900/40 to-purple-800/20 border-purple-700/40",
  tron: "from-red-800/40 to-red-700/20 border-red-600/40",
  xrp: "from-gray-800/40 to-gray-700/20 border-gray-600/40",
  near: "from-teal-900/40 to-teal-800/20 border-teal-700/40",
  aptos: "from-green-900/40 to-green-800/20 border-green-700/40",
};

interface ChainCardProps {
  account: WalletAccount;
  onSend?: (account: WalletAccount) => void;
  onReceive?: (account: WalletAccount) => void;
}

function formatBalance(balance: bigint, decimals: number, symbol: string): string {
  if (balance === 0n) return `0 ${symbol}`;
  const divisor = BigInt(10 ** decimals);
  const whole = balance / divisor;
  const fractional = balance % divisor;
  const fracStr = fractional.toString().padStart(decimals, "0").slice(0, 6).replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr} ${symbol}` : `${whole} ${symbol}`;
}

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ChainCard({ account, onSend, onReceive }: ChainCardProps): React.JSX.Element {
  const balanceEntry = useWalletStore((s) => s.getBalance(account.chainId, account.address));
  const adapter = useWalletStore((s) => s.getAdapter(account.chainId));
  const isUnlocked = useWalletStore((s) => s.isUnlocked());

  const icon = CHAIN_ICONS[account.chainId] ?? "●";
  const colorClass = CHAIN_COLORS[account.chainId] ?? "from-gray-900/40 to-gray-800/20 border-gray-700/40";
  const symbol = adapter?.symbol ?? account.chainId.toUpperCase();
  const decimals = adapter?.decimals ?? 18;
  const native = balanceEntry?.native ?? 0n;

  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 ${colorClass}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <p className="text-white font-semibold text-sm">{account.name}</p>
            <button
              onClick={() => navigator.clipboard.writeText(account.address)}
              title="Copy address"
              className="text-gray-400 hover:text-gray-200 font-mono text-xs transition-colors"
            >
              {truncateAddress(account.address)} ⧉
            </button>
          </div>
        </div>
        <span className="text-xs text-gray-500 bg-gray-800/60 px-2 py-0.5 rounded-full">
          {adapter?.name ?? account.chainId}
        </span>
      </div>

      <div className="mb-4">
        <p className="text-2xl font-bold text-white">
          {balanceEntry ? formatBalance(native, decimals, symbol) : <span className="text-gray-600">···</span>}
        </p>
        {balanceEntry?.tokens && balanceEntry.tokens.length > 0 && (
          <div className="flex gap-2 mt-1 flex-wrap">
            {balanceEntry.tokens.slice(0, 3).map((t) => (
              <span key={t.contractAddress ?? t.symbol} className="text-xs text-gray-400 bg-gray-800/60 px-2 py-0.5 rounded-full">
                {formatBalance(t.balance, t.decimals, t.symbol)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          disabled={!isUnlocked}
          onClick={() => onSend?.(account)}
          className="flex-1 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 disabled:opacity-40 rounded-lg transition-colors"
        >
          Send
        </button>
        <button
          onClick={() => onReceive?.(account)}
          className="flex-1 py-2 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
        >
          Receive
        </button>
      </div>
    </div>
  );
}
