"use client";

import { useState } from "react";
import { useWalletStore } from "@wallet/store";
import { signInWithOtp, verifyOtp, saveWalletToCloud } from "@/lib/walletCloud";
import { isSupabaseConfigured } from "@/lib/supabase";

type Step = "offer" | "email" | "otp" | "syncing" | "done";

interface CloudBackupPromptProps {
  onDone: () => void;
}

export function CloudBackupPrompt({ onDone }: CloudBackupPromptProps): JSX.Element {
  const wallet = useWalletStore((s) => s.getActiveWallet());

  const [step, setStep] = useState<Step>("offer");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="text-4xl">☁</div>
          <h2 className="text-xl font-bold text-white">Cloud Backup Unavailable</h2>
          <p className="text-gray-400 text-sm">
            Cloud backup is not configured for this deployment. Your wallet is safely stored on this device.
          </p>
          <button
            onClick={onDone}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
          >
            Continue to Wallet
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

  async function handleVerifyOtp() {
    if (otp.length < 4) { setError("Enter the 6-digit code from your email."); return; }
    setError("");
    setLoading(true);
    try {
      await verifyOtp(email, otp);
      setStep("syncing");
      if (wallet) await saveWalletToCloud(wallet);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
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
              Your encrypted wallet will be backed up to our servers. Only you can decrypt it with your password —
              we never see your keys.
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
              <span className="text-green-400">✓</span> Syncs automatically when you add wallets
            </div>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setStep("email")}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
            >
              Enable Cloud Backup
            </button>
            <button
              onClick={onDone}
              className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl text-sm transition-colors border border-gray-700"
            >
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
            <p className="text-gray-400 mt-1 text-sm">We&apos;ll send a one-time code to verify your identity. No password needed.</p>
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
            <h2 className="text-2xl font-bold text-white">Check Your Email</h2>
            <p className="text-gray-400 mt-1 text-sm">
              Enter the 6-digit code we sent to <span className="text-white">{email}</span>
            </p>
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
            placeholder="000000"
            className="w-full p-3 bg-gray-900 text-white rounded-xl border border-gray-700 focus:border-indigo-500 focus:outline-none text-sm text-center tracking-widest font-mono text-lg"
          />
          {error && <p className="text-red-400 text-sm bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">{error}</p>}
          <button
            disabled={loading || otp.length < 6}
            onClick={handleVerifyOtp}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? "Verifying…" : "Verify & Backup"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "syncing") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Backing up to cloud…</p>
        </div>
      </div>
    );
  }

  // done
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="text-5xl">✓</div>
        <h2 className="text-2xl font-bold text-white">Backup Enabled</h2>
        <p className="text-gray-400 text-sm">
          Your wallet is backed up to <span className="text-white">{email}</span>.
          Use this email to restore it on any device.
        </p>
        <button
          onClick={onDone}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
        >
          Go to Wallet
        </button>
      </div>
    </div>
  );
}
