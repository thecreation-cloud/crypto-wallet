"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useWalletStore } from "@wallet/store";
import { adapters } from "@/lib/adapters";

export function WalletProvider({ children }: { children: ReactNode }): JSX.Element {
  const registerAdapter = useWalletStore((s) => s.registerAdapter);

  useEffect(() => {
    adapters.forEach((adapter) => registerAdapter(adapter));
  }, []);

  return <>{children}</>;
}
