import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { deriveKey, deriveEd25519Key } from "@wallet/core";

const ED25519_CHAINS = new Set(["solana", "near", "aptos"]);
import type { ChainId, StoredWallet, WalletAccount, ChainAdapter } from "@wallet/core";
import type { WalletStore, ActiveSession, BalanceEntry } from "./types.js";

const BALANCE_CACHE_MS = 30_000;

function balanceKey(chainId: ChainId, address: string): string {
  return `${chainId}:${address}`;
}

export const useWalletStore = create<WalletStore>()(
  immer((set, get) => ({
    wallets: [],
    activeWalletId: null,
    session: null,
    balances: {},
    transactions: {},
    adapters: new Map(),

    addWallet: (wallet) => {
      set((s) => {
        s.wallets.push(wallet);
        if (!s.activeWalletId) s.activeWalletId = wallet.id;
      });
    },

    removeWallet: (id) => {
      set((s) => {
        s.wallets = s.wallets.filter((w) => w.id !== id);
        if (s.activeWalletId === id) {
          s.activeWalletId = s.wallets[0]?.id ?? null;
          if (s.session?.walletId === id) s.session = null;
        }
      });
    },

    selectWallet: (id) => {
      set((s) => {
        s.activeWalletId = id;
      });
    },

    getActiveWallet: () => {
      const { wallets, activeWalletId } = get();
      return wallets.find((w) => w.id === activeWalletId) ?? null;
    },

    getActiveAccounts: () => {
      return get().getActiveWallet()?.accounts ?? [];
    },

    unlock: (walletId, seedBytes) => {
      set((s) => {
        s.session = { walletId, unlockedAt: Date.now(), seedBytes };
        s.activeWalletId = walletId;
      });
    },

    lock: () => {
      set((s) => {
        s.session = null;
      });
    },

    isUnlocked: () => get().session !== null,

    registerAdapter: (adapter) => {
      set((s) => {
        s.adapters.set(adapter.chainId, adapter);
      });
    },

    getAdapter: (chainId) => get().adapters.get(chainId),

    refreshBalance: async (account) => {
      const adapter = get().adapters.get(account.chainId);
      if (!adapter) return;

      const key = balanceKey(account.chainId, account.address);
      const cached = get().balances[key];
      if (cached && Date.now() - cached.lastUpdated < BALANCE_CACHE_MS) return;

      const [native, tokens, txs] = await Promise.all([
        adapter.getBalance(account.address),
        adapter.getTokenBalances(account.address),
        adapter.getTransactions(account.address),
      ]);

      set((s) => {
        s.balances[key] = {
          chainId: account.chainId,
          address: account.address,
          native,
          tokens,
          lastUpdated: Date.now(),
        } satisfies BalanceEntry;
        s.transactions[key] = txs;
      });
    },

    refreshAllBalances: async () => {
      const accounts = get().getActiveAccounts();
      await Promise.allSettled(accounts.map((acc) => get().refreshBalance(acc)));
    },

    sendTransaction: async (account, to, value, tokenAddress) => {
      const { session, adapters } = get();
      if (!session) throw new Error("Wallet is locked — unlock before sending");

      const adapter = adapters.get(account.chainId);
      if (!adapter) throw new Error(`No adapter registered for chain ${account.chainId}`);

      const derive = ED25519_CHAINS.has(account.chainId) ? deriveEd25519Key : deriveKey;
      const { privateKey } = derive(session.seedBytes, account.derivationPath);
      const { hash } = await adapter.sendTransaction({
        from: account.address,
        to,
        value,
        privateKey,
        tokenAddress,
      });

      await get().refreshBalance(account);
      return hash;
    },

    getBalance: (chainId, address) => get().balances[balanceKey(chainId, address)],

    getTransactions: (chainId, address) => get().transactions[balanceKey(chainId, address)] ?? [],
  })),
);
