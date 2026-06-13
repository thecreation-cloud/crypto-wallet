"use client";

import { WalletProvider } from "@/components/WalletProvider";
import { WalletApp } from "@/components/WalletApp";

export default function Home() {
  return (
    <WalletProvider>
      <WalletApp />
    </WalletProvider>
  );
}
