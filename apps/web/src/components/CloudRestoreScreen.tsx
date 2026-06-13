"use client";

import { useState } from "react";
import { useWalletStore } from "@wallet/store";
import { signInWithOtp, verifyOtp, loadWalletsFromCloud } from "@/lib/walletCloud";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { StoredWallet } from "@wallet/core";

type Step = "email" | "otp" | "loading" | "done" | "empty";

interface CloudRestoreScreenProps {
  onBack: () => void;
}

export function CloudRestoreScreen({ onBack }: CloudRestoreScreenProps): JSX.Element {
  const addWallet = useWalletStore((s) => s.addWallet);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState<StoredWallet[]>([]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="text-4xl">☁</div>
          <h2 className="text-xl font-bold text-white">Cloud Backup Unavailable</h2>
          <p className="text-gray-400 text-sm">
            Cloud backup is not configured for this deployment.
          </p>
          <button onClick={onBack} className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors border border-gray-700">
            ← Back
          </button>
        </div>
      </div>
    );
  }

  async function handleSendOtp() {
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    setError("");
    setLoading(true);
    try {
      await signInWithOtp(email);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndRestore() {
    if (otp.length < 4) { setError("Enter the 6-digit code from your email."); return; }
    setError("");
    setLoading(true);
    try {
      await verifyOtp(email, otp);
      setStep("loading");
      const wallets = await loadWalletsFromCloud();
      if (wallets.length === 0) {
        setStep("empty");
        return;
      }
      wallets.forEach((w) => addWallet(w));
      setRestored(wallets);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
      setStep("otp");
    } finally {
      setLoading(false);
    }
  }

  if (step === "email") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-5">
          <div>
            <button onClick={onBack} className="text-gray-500 hover:text-gray-300 text-sm mb-4 transition-colors">← Back</button>
            <h2 className="text-2xl font-bold text-white">Restore from Cloud</h2>
            <p className="text-gray-400 mt-1 text-sm">Enter the email address you used when setting up cloud backup.</p>
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
            placeholder="you@example.com"
            className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700 focus:border-indigo-500 focus:outline-none text-sm"
          />
          {error && <p className="text-red-400 text-sm bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
          <button
            disabled={loading || !email}
            onClick={handleSendOtp}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? "Sending…" : "Send Code"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-5">
          <div>
            <button onClick={() => setStep("email")} className="text-gray-500 hover:text-gray-300 text-sm mb-4 transition-colors">← Back</button>
            <h2 className="text-2xl font-bold text-white">Enter Your Code</h2>
            <p className="text-gray-400 mt-1 text-sm">
              Check <span className="text-white">{email}</span> for a 6-digit code.
            </p>
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleVerifyAndRestore()}
            placeholder="000000"
            className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700 focus:border-indigo-500 focus:outline-none text-sm text-center tracking-widest font-mono text-lg"
          />
          {error && <p className="text-red-400 text-sm bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
          <button
            disabled={loading || otp.length < 6}
            onClick={handleVerifyAndRestore}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? "Verifying…" : "Restore Wallet"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Downloading from cloud…</p>
        </div>
      </div>
    );
  }

  if (step === "empty") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="text-4xl">☁</div>
          <h2 className="text-xl font-bold text-white">No Backups Found</h2>
          <p className="text-gray-400 text-sm">
            There are no wallets backed up under <span className="text-white">{email}</span>.
          </p>
          <button onClick={onBack} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors">
            ← Back to Setup
          </button>
        </div>
      </div>
    );
  }

  // done
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="text-5xl">✓</div>
        <h2 className="text-2xl font-bold text-white">Wallet Restored</h2>
        <p className="text-gray-400 text-sm">
          {restored.length === 1
            ? `"${restored[0]?.name}" has been restored.`
            : `${restored.length} wallets restored.`}{" "}
          Enter your password to unlock.
        </p>
        <button
          onClick={onBack}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
        >
          Go to Unlock Screen
        </button>
      </div>
    </div>
  );
}
