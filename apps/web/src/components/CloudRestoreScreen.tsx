"use client";

import { useState } from "react";
import { signInWithLink } from "@/lib/walletCloud";
import { isSupabaseConfigured } from "@/lib/supabase";

type Step = "email" | "sent";

interface CloudRestoreScreenProps {
  onBack: () => void;
}

export function CloudRestoreScreen({ onBack }: CloudRestoreScreenProps): JSX.Element {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="text-4xl">☁</div>
          <h2 className="text-xl font-bold text-white">Cloud Backup Unavailable</h2>
          <p className="text-gray-400 text-sm">Cloud backup is not configured for this deployment.</p>
          <button onClick={onBack} className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors border border-gray-700">← Back</button>
        </div>
      </div>
    );
  }

  async function handleSend() {
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    setError("");
    setLoading(true);
    try {
      localStorage.setItem("pending_cloud_action", "restore");
      await signInWithLink(email);
      setStep("sent");
    } catch (err) {
      localStorage.removeItem("pending_cloud_action");
      setError(err instanceof Error ? err.message : "Failed to send link");
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
            <p className="text-gray-400 mt-1 text-sm">
              Enter the email you used when setting up cloud backup. We&apos;ll send you a secure link.
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
          Click it and your wallet will restore automatically.
        </p>
        <p className="text-gray-600 text-xs">The link will open this app and restore your wallet.</p>
        <button onClick={onBack} className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors border border-gray-700">
          ← Back to Setup
        </button>
      </div>
    </div>
  );
}
