import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useWalletStore } from "@wallet/store";
import type { WalletAccount } from "@wallet/core";

function formatBalance(balance: bigint, decimals: number, symbol: string): string {
  if (balance === 0n) return `0 ${symbol}`;
  const d = BigInt(10 ** decimals);
  const whole = balance / d;
  const frac = (balance % d).toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return frac ? `${whole}.${frac} ${symbol}` : `${whole} ${symbol}`;
}

function truncateAddress(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

const CHAIN_COLORS: Record<string, string> = {
  ethereum: "#6366f1", bnb: "#eab308", polygon: "#8b5cf6",
  arbitrum: "#0ea5e9", optimism: "#f43f5e", base: "#3b82f6",
  bitcoin: "#f97316", solana: "#a855f7", tron: "#ef4444", xrp: "#6b7280",
};

function ChainCard({ account, onSend, onReceive }: {
  account: WalletAccount;
  onSend: () => void;
  onReceive: () => void;
}) {
  const balanceEntry = useWalletStore((s) => s.getBalance(account.chainId, account.address));
  const adapter = useWalletStore((s) => s.getAdapter(account.chainId));
  const isUnlocked = useWalletStore((s) => s.isUnlocked());

  const color = CHAIN_COLORS[account.chainId] ?? "#6b7280";
  const symbol = adapter?.symbol ?? account.chainId.toUpperCase();
  const decimals = adapter?.decimals ?? 18;

  return (
    <View style={[styles.card, { borderColor: color + "60" }]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.chainName}>{account.name}</Text>
          <Pressable onPress={() => Clipboard.setStringAsync(account.address)}>
            <Text style={styles.address}>{truncateAddress(account.address)} ⧉</Text>
          </Pressable>
        </View>
        <View style={[styles.badge, { backgroundColor: color + "30" }]}>
          <Text style={[styles.badgeText, { color }]}>{adapter?.name ?? account.chainId}</Text>
        </View>
      </View>
      <Text style={styles.balance}>
        {balanceEntry
          ? formatBalance(balanceEntry.native, decimals, symbol)
          : "···"}
      </Text>
      <View style={styles.cardButtons}>
        <TouchableOpacity
          style={[styles.cardButton, !isUnlocked && styles.disabled]}
          disabled={!isUnlocked}
          onPress={onSend}
        >
          <Text style={styles.cardButtonText}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cardButton} onPress={onReceive}>
          <Text style={styles.cardButtonText}>Receive</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const wallet = useWalletStore((s) => s.getActiveWallet());
  const accounts = useWalletStore((s) => s.getActiveAccounts());
  const refreshAll = useWalletStore((s) => s.refreshAllBalances);
  const lock = useWalletStore((s) => s.lock);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refreshAll().catch(() => {});
    setRefreshing(false);
  }

  useEffect(() => { void handleRefresh(); }, [wallet?.id]);

  if (!wallet) return null;

  return (
    <ScrollView
      style={styles.screen}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4f46e5" />}
    >
      <View style={styles.topBar}>
        <View>
          <Text style={styles.walletName}>{wallet.name}</Text>
          <Text style={styles.walletSub}>{accounts.length} chains</Text>
        </View>
        <TouchableOpacity style={styles.lockButton} onPress={() => { lock(); router.replace("/unlock"); }}>
          <Text style={styles.lockButtonText}>Lock</Text>
        </TouchableOpacity>
      </View>

      {accounts.map((account) => (
        <ChainCard
          key={account.id}
          account={account}
          onSend={() => router.push({ pathname: "/send", params: { chainId: account.chainId, address: account.address } })}
          onReceive={() => router.push({ pathname: "/receive", params: { address: account.address, chainId: account.chainId } })}
        />
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#030712" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#1f2937" },
  walletName: { color: "#ffffff", fontWeight: "700", fontSize: 18 },
  walletSub: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  lockButton: { backgroundColor: "#1f2937", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#374151" },
  lockButtonText: { color: "#9ca3af", fontSize: 12 },
  card: { margin: 16, marginBottom: 0, borderRadius: 16, borderWidth: 1, backgroundColor: "#0f172a", padding: 16 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  chainName: { color: "#ffffff", fontWeight: "600", fontSize: 15 },
  address: { color: "#6b7280", fontSize: 12, fontFamily: "monospace", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  balance: { color: "#ffffff", fontWeight: "700", fontSize: 22, marginBottom: 14 },
  cardButtons: { flexDirection: "row", gap: 8 },
  cardButton: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", padding: 10, borderRadius: 10, alignItems: "center" },
  cardButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "500" },
  disabled: { opacity: 0.4 },
});
