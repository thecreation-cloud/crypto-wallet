import { supabase } from "./supabase";
import type { StoredWallet } from "@wallet/core";

// --- Auth ---

export async function signInWithOtp(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw new Error(error.message);
}

export async function verifyOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// --- Wallet sync ---

export async function saveWalletToCloud(wallet: StoredWallet): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in to cloud");

  const { error } = await supabase.from("wallets").upsert(
    {
      user_id: session.user.id,
      wallet_id: wallet.id,
      wallet_name: wallet.name,
      encrypted_data: wallet,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "wallet_id" },
  );
  if (error) throw new Error(error.message);
}

export async function loadWalletsFromCloud(): Promise<StoredWallet[]> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in to cloud");

  const { data, error } = await supabase
    .from("wallets")
    .select("encrypted_data")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { encrypted_data: unknown }) => row.encrypted_data as StoredWallet);
}
