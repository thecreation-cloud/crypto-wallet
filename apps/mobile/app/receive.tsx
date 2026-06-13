import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";

export default function ReceiveScreen() {
  const { address, chainId } = useLocalSearchParams<{ address: string; chainId: string }>();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={styles.container}>
      <View style={styles.qrPlaceholder}>
        <Text style={styles.qrIcon}>📲</Text>
        <Text style={styles.qrHint}>Add expo-qrcode or react-native-qrcode-svg for QR</Text>
      </View>
      <Text style={styles.label}>Your {chainId?.toUpperCase()} address</Text>
      <View style={styles.addressBox}>
        <Text style={styles.address} selectable>{address}</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleCopy}>
        <Text style={styles.buttonText}>{copied ? "Copied!" : "Copy Address"}</Text>
      </TouchableOpacity>
      <Text style={styles.warning}>Only send {chainId?.toUpperCase()} assets to this address.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#030712", alignItems: "center" },
  qrPlaceholder: { width: 200, height: 200, backgroundColor: "#ffffff", borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  qrIcon: { fontSize: 40, marginBottom: 8 },
  qrHint: { color: "#6b7280", fontSize: 11, textAlign: "center", paddingHorizontal: 12 },
  label: { color: "#9ca3af", fontSize: 12, marginBottom: 8 },
  addressBox: { backgroundColor: "#111827", borderRadius: 12, padding: 14, width: "100%", marginBottom: 16, borderWidth: 1, borderColor: "#374151" },
  address: { color: "#ffffff", fontFamily: "monospace", fontSize: 13, textAlign: "center" },
  button: { backgroundColor: "#4f46e5", padding: 14, borderRadius: 12, width: "100%", alignItems: "center", marginBottom: 12 },
  buttonText: { color: "#ffffff", fontWeight: "600" },
  warning: { color: "#6b7280", fontSize: 12, textAlign: "center" },
});
