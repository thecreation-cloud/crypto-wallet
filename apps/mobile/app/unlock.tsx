import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { decrypt, mnemonicToSeed } from "@wallet/core";
import { useWalletStore } from "@wallet/store";
import type { EncryptedPayload } from "@wallet/core";

export default function UnlockScreen() {
  const router = useRouter();
  const wallets = useWalletStore((s) => s.wallets);
  const activeWalletId = useWalletStore((s) => s.activeWalletId);
  const unlock = useWalletStore((s) => s.unlock);

  const wallet = wallets.find((w) => w.id === activeWalletId) ?? wallets[0];
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUnlock() {
    if (!wallet) return;
    setLoading(true);
    try {
      const payload = JSON.parse(wallet.encryptedMnemonic) as EncryptedPayload;
      const mnemonic = await decrypt(payload, password);
      const seed = mnemonicToSeed(mnemonic);
      unlock(wallet.id, seed);
      router.replace("/dashboard");
    } catch {
      Alert.alert("Wrong password", "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔐</Text>
      <Text style={styles.title}>{wallet?.name ?? "Wallet"}</Text>
      <Text style={styles.subtitle}>Enter your password to unlock</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#6b7280"
        secureTextEntry
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleUnlock}
      />
      <TouchableOpacity
        style={[styles.button, (!password || loading) && styles.disabled]}
        disabled={!password || loading}
        onPress={handleUnlock}
      >
        <Text style={styles.buttonText}>{loading ? "Unlocking..." : "Unlock"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#030712" },
  icon: { fontSize: 52, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: "700", color: "#ffffff", marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#9ca3af", marginBottom: 32, textAlign: "center" },
  input: { backgroundColor: "#111827", color: "#ffffff", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#374151", fontSize: 15, width: "100%", marginBottom: 12, textAlign: "center" },
  button: { backgroundColor: "#4f46e5", padding: 16, borderRadius: 12, alignItems: "center", width: "100%" },
  buttonText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },
  disabled: { opacity: 0.4 },
});
