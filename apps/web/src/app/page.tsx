"use client";

import { WalletProvider } from "@/components/WalletProvider";
import { WalletApp } from "@/components/WalletApp";

export default function Home(): JSX.Element {
  return (
    <WalletProvider>
      <WalletApp />
    </WalletProvider>
  );
}
