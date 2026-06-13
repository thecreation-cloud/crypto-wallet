"use client";

import { useEffect } from "react";
import { useWalletStore } from "@wallet/store";
import { adapters } from "@/lib/adapters";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const registerAdapter = useWalletStore((s) => s.registerAdapter);

  useEffect(() => {
    adapters.forEach((adapter) => registerAdapter(adapter));
  }, []);

  return <>{children}</>;
}
