"use client";

import React, { useState } from "react";
import type { WalletAccount } from "@wallet/core";

interface ReceiveModalProps {
  account: WalletAccount;
  onClose: () => void;
}

export function ReceiveModal({ account, onClose }: ReceiveModalProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Receive {account.chainId.charAt(0).toUpperCase() + account.chainId.slice(1)}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="w-48 h-48 bg-white rounded-2xl flex items-center justify-center">
              <div className="text-gray-400 text-sm text-center p-4">
                <div className="text-4xl mb-2">📲</div>
                <p>QR Code</p>
                <p className="text-xs mt-1">(install qrcode.react)</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-gray-400 text-xs mb-2">Your {account.name} address</p>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-white font-mono text-sm break-all">{account.address}</p>
            </div>
          </div>

          <button
            onClick={handleCopy}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
          >
            {copied ? "Copied!" : "Copy Address"}
          </button>

          <p className="text-gray-500 text-xs">
            Only send {account.chainId.charAt(0).toUpperCase() + account.chainId.slice(1)} assets to this address.
          </p>
        </div>
      </div>
    </div>
  );
}
