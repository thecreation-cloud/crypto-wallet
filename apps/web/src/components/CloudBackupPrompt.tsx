"use client";

import { useState } from "react";
import { signInWithLink } from "@/lib/walletCloud";
import { isSupabaseConfigured } from "@/lib/supabase";

type Step = "offer" | "email" | "sent";

interface CloudBackupPromptProps {
  onDone: () => void;
}

export function CloudBackupPrompt({ onDone }: CloudBackupPromptProps): JSX.Element {
  const [step, setStep] = useState<Step>("offer");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="text-4xl">☁</div>
          <h2 className="text-xl font-bold text-white">Cloud Backup Unavailable</h2>
          <p className="text-gray-400 text-sm">
            Cloud backup is not configured. Your wallet is safely stored on this device.
          </p>
          <button onClick={onDone} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors">
            Continue to Wallet
          </button>
        </div>
      </div>
    );
  }

  async function handleSend() {
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    setError("");
    setLoading(true);
    try {
      // Store intent so WalletApp auto-syncs when user returns from the link
      localStorage.setItem("pending_cloud_action", "backup");
      await signInWithLink(email);
      setStep("sent");
    } catch (err) {
      localStorage.removeItem("pending_cloud_action");
      setError(err instanceof Error ? err.message : "Failed to send link");
    } finally {
      setLoading(false);
    }
  }

  if (step === "offer") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="text-5xl mb-2">☁</div>
            <h2 className="text-2xl font-bold text-white">Enable Cloud Backup?</h2>
            <p className="text-gray-400 text-sm">
              Your encrypted wallet will be backed up. Only you can decrypt it with your
              password — we never see your keys.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-300">
              <span className="text-green-400">✓</span> Restore on any device without your seed phrase
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <span className="text-green-400">✓</span> End-to-end encrypted — we can&apos;t read your wallet
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <span className="text-green-400">✓</span> One click via email — no extra password
            </div>
          </div>
          <div className="space-y-3">
            <button onClick={() => setStep("email")} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors">
              Enable Cloud Backup
            </button>
            <button onClick={onDone} className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl text-sm transition-colors border border-gray-700">
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "email") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-5">
          <div>
            <button onClick={() => setStep("offer")} className="text-gray-500 hover:text-gray-300 text-sm mb-4 transition-colors">← Back</button>
            <h2 className="text-2xl font-bold text-white">Enter Your Email</h2>
            <p className="text-gray-400 mt-1 text-sm">
              We&apos;ll email you a secure link. Click it to confirm and your wallet will be backed up automatically.
            </p>
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="you@example.com"
            autoFocus
            className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700 focus:border-indigo-500 focus:outline-none text-sm"
          />
          {error && <p className="text-red-400 text-sm bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
          <button
            disabled={loading || !email}
            onClick={handleSend}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? "Sending…" : "Send Link"}
          </button>
        </div>
      </div>
    );
  }

  // sent
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="text-5xl">✉</div>
        <h2 className="text-2xl font-bold text-white">Check Your Email</h2>
        <p className="text-gray-400 text-sm">
          We sent a link to <span className="text-white font-medium">{email}</span>.
          Click it and your wallet will be backed up automatically.
        </p>
        <p className="text-gray-600 text-xs">You can close this tab — the link will bring you back.</p>
        <button onClick={onDone} className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors border border-gray-700">
          Skip for now
        </button>
      </div>
    </div>
  );
}
