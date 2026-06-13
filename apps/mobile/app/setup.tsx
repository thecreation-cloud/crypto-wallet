import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { generateMnemonic, validateMnemonic, mnemonicToSeed, encrypt, deriveKey, deriveEd25519Key } from "@wallet/core";
import { useWalletStore } from "@wallet/store";
import type { StoredWallet, WalletAccount } from "@wallet/core";
import { adapters } from "@/lib/adapters";

const ED25519_CHAINS = new Set(["solana", "near", "aptos"]);

type Step = "choice" | "backup" | "import" | "password";

export default function SetupScreen() {
  const router = useRouter();
  const addWallet = useWalletStore((s) => s.addWallet);
  const unlock = useWalletStore((s) => s.unlock);

  const [step, setStep] = useState<Step>("choice");
  const [mnemonic, setMnemonic] = useState("");
  const [importInput, setImportInput] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [walletName, setWalletName] = useState("My Wallet");
  const [loading, setLoading] = useState(false);

  function handleCreate() {
    setMnemonic(generateMnemonic(128));
    setStep("backup");
  }

  async function handleFinish(finalMnemonic: string) {
    if (!validateMnemonic(finalMnemonic)) {
      Alert.alert("Invalid phrase", "Please check your recovery phrase.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Weak password", "Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const seed = mnemonicToSeed(finalMnemonic);
      const encryptedMnemonic = await encrypt(finalMnemonic, password);
      const walletId = Math.random().toString(36).slice(2);

      const accounts: WalletAccount[] = adapters.map((adapter) => {
        const path = adapter.derivationPath(0);
        const derived = ED25519_CHAINS.has(adapter.chainId)
          ? deriveEd25519Key(seed, path)
          : deriveKey(seed, path);
        return {
          id: Math.random().toString(36).slice(2),
          name: adapter.name,
          chainId: adapter.chainId,
          address: adapter.deriveAddress(derived.publicKey),
          publicKey: Buffer.from(derived.publicKey).toString("hex"),
          derivationPath: path,
          accountIndex: 0,
        };
      });

      const wallet: StoredWallet = {
        id: walletId,
        name: walletName,
        encryptedMnemonic: JSON.stringify(encryptedMnemonic),
        accounts,
        createdAt: Date.now(),
      };

      addWallet(wallet);
      unlock(walletId, seed);
      router.replace("/dashboard");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (step === "choice") {
    return (
      <View style={styles.center}>
        <Text style={styles.icon}>🔐</Text>
        <Text style={styles.title}>Crypto Wallet</Text>
        <Text style={styles.subtitle}>Your keys, your coins.</Text>
        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleCreate}>
            <Text style={styles.primaryButtonText}>Create New Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep("import")}>
            <Text style={styles.secondaryButtonText}>Import with Recovery Phrase</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === "backup") {
    const words = mnemonic.split(" ");
    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Back Up Recovery Phrase</Text>
        <Text style={styles.subtitle}>Write these 12 words in order and store them safely.</Text>
        <View style={styles.phraseGrid}>
          {words.map((word, i) => (
            <View key={i} style={styles.wordBox}>
              <Text style={styles.wordIndex}>{i + 1}.</Text>
              <Text style={styles.wordText}>{word}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={() => setStep("password")}>
          <Text style={styles.primaryButtonText}>I've Saved It →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (step === "import") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Import Wallet</Text>
        <Text style={styles.subtitle}>Enter your 12 or 24-word recovery phrase.</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={importInput}
          onChangeText={setImportInput}
          placeholder="word1 word2 word3 ..."
          placeholderTextColor="#6b7280"
          multiline
          numberOfLines={4}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.primaryButton, !importInput.trim() && styles.disabled]}
          disabled={!importInput.trim()}
          onPress={() => { setMnemonic(importInput.trim().toLowerCase()); setStep("password"); }}
        >
          <Text style={styles.primaryButtonText}>Continue →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Protect Your Wallet</Text>
      <Text style={styles.subtitle}>This password encrypts your wallet on this device.</Text>
      <TextInput style={styles.input} value={walletName} onChangeText={setWalletName} placeholder="Wallet name" placeholderTextColor="#6b7280" />
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password (min 8 chars)" placeholderTextColor="#6b7280" secureTextEntry />
      <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" placeholderTextColor="#6b7280" secureTextEntry />
      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.disabled]}
        disabled={loading}
        onPress={() => handleFinish(mnemonic)}
      >
        <Text style={styles.primaryButtonText}>{loading ? "Creating..." : "Create Wallet"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#030712" },
  container: { flex: 1, padding: 24, backgroundColor: "#030712" },
  scrollContent: { padding: 24, backgroundColor: "#030712", minHeight: "100%" },
  icon: { fontSize: 52, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "700", color: "#ffffff", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#9ca3af", marginBottom: 32, textAlign: "center" },
  buttonGroup: { width: "100%", gap: 12 },
  primaryButton: { backgroundColor: "#4f46e5", padding: 16, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  primaryButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },
  secondaryButton: { backgroundColor: "#1f2937", padding: 16, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: "#374151" },
  secondaryButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },
  disabled: { opacity: 0.4 },
  phraseGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  wordBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#111827", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, width: "30%" },
  wordIndex: { color: "#6b7280", fontSize: 12, width: 18 },
  wordText: { color: "#ffffff", fontSize: 13, fontFamily: "monospace" },
  input: { backgroundColor: "#111827", color: "#ffffff", borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#374151", fontSize: 14 },
  textArea: { height: 100, textAlignVertical: "top" },
});
