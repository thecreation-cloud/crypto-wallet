"use client";

import React, { useState, useEffect } from "react";
import { useWalletStore } from "@wallet/store";
import type { WalletAccount } from "@wallet/core";

interface SendModalProps {
  account: WalletAccount;
  onClose: () => void;
}

type Status = "idle" | "loading" | "success" | "error";

export function SendModal({ account, onClose }: SendModalProps): React.JSX.Element {
  const sendTransaction = useWalletStore((s) => s.sendTransaction);
  const adapter = useWalletStore((s) => s.getAdapter(account.chainId));
  const price = useWalletStore((s) => s.prices[account.chainId]);

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [txHash, setTxHash] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [estimatedFee, setEstimatedFee] = useState<bigint | null>(null);
  const [estimating, setEstimating] = useState(false);

  const decimals = adapter?.decimals ?? 18;
  const symbol = adapter?.symbol ?? account.chainId.toUpperCase();

  function parseAmount(value: string): bigint {
    if (!value || isNaN(Number(value))) return 0n;
    const [whole, frac = ""] = value.split(".");
    const fracPadded = frac.slice(0, decimals).padEnd(decimals, "0");
    return BigInt(whole ?? "0") * BigInt(10 ** decimals) + BigInt(fracPadded);
  }

  function formatBalance(value: bigint, dec: number): string {
    if (value === 0n) return "0";
    const divisor = BigInt(10 ** dec);
    const whole = value / divisor;
    const frac = (value % divisor).toString().padStart(dec, "0").slice(0, 6).replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : `${whole}`;
  }

  // Debounced gas estimate — fires 600ms after to/amount stops changing
  useEffect(() => {
    setEstimatedFee(null);
    if (!adapter?.estimateFee || !to || !amount) return;

    const parsed = parseAmount(amount);
    if (parsed === 0n) return;

    const timer = setTimeout(async () => {
      setEstimating(true);
      try {
        const fee = await adapter.estimateFee!(account.address, to, parsed);
        setEstimatedFee(fee);
      } catch {
        // estimation failed silently
      } finally {
        setEstimating(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [to, amount]);

  async function handleSend() {
    if (!to || !amount) return;
    if (!adapter?.validateAddress(to)) {
      setErrorMsg("Invalid recipient address.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    try {
      const hash = await sendTransaction(account, to, parseAmount(amount));
      setTxHash(hash);
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Transaction failed");
      setStatus("error");
    }
  }

  const feeUsd =
    estimatedFee !== null && price
      ? (Number(estimatedFee) / 10 ** decimals) * price
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Send {symbol}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        {status === "success" ? (
          <div className="space-y-4 text-center py-4">
            <div className="text-5xl">✓</div>
            <p className="text-white font-semibold">Transaction Sent</p>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-gray-400 text-xs mb-1">Transaction Hash</p>
              <p className="text-white font-mono text-xs break-all">{txHash}</p>
            </div>
            {adapter?.explorerUrl && (
              <a
                href={`${adapter.explorerUrl}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:text-indigo-300 text-sm"
              >
                View on explorer →
              </a>
            )}
            <button onClick={onClose} className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm transition-colors">
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">From</label>
                <div className="p-3 bg-gray-800 rounded-xl text-white font-mono text-sm break-all">
                  {account.address}
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">To</label>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="Recipient address"
                  className="w-full p-3 bg-gray-800 text-white rounded-xl border border-gray-700 focus:border-indigo-500 focus:outline-none font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1.5 block">Amount ({symbol})</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="any"
                  className="w-full p-3 bg-gray-800 text-white rounded-xl border border-gray-700 focus:border-indigo-500 focus:outline-none text-sm"
                />
              </div>
            </div>

            {/* Gas estimate */}
            <div className="h-8 flex items-center">
              {estimating && (
                <p className="text-gray-500 text-xs">Estimating fee…</p>
              )}
              {!estimating && estimatedFee !== null && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-gray-500">Estimated fee:</span>
                  <span className="text-gray-300 font-medium">
                    {formatBalance(estimatedFee, decimals)} {symbol}
                  </span>
                  {feeUsd !== null && (
                    <span className="text-gray-500">
                      (~${feeUsd < 0.01 ? feeUsd.toFixed(4) : feeUsd.toFixed(2)})
                    </span>
                  )}
                </div>
              )}
            </div>

            {status === "error" && errorMsg && (
              <p className="text-red-400 text-sm bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">{errorMsg}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm transition-colors border border-gray-700"
              >
                Cancel
              </button>
              <button
                disabled={!to || !amount || status === "loading"}
                onClick={handleSend}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                {status === "loading" ? "Sending…" : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
