import { Redirect } from "expo-router";
import { useWalletStore } from "@wallet/store";

export default function Index() {
  const wallets = useWalletStore((s) => s.wallets);
  const isUnlocked = useWalletStore((s) => s.isUnlocked());

  if (wallets.length === 0) return <Redirect href="/setup" />;
  if (!isUnlocked) return <Redirect href="/unlock" />;
  return <Redirect href="/dashboard" />;
}
