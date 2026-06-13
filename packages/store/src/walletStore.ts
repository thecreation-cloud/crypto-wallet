import { create, type UseBoundStore, type StoreApi } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist } from "zustand/middleware";
import { deriveKey, deriveEd25519Key } from "@wallet/core";

const ED25519_CHAINS = new Set(["solana", "near", "aptos"]);
import type { ChainId, StoredWallet, WalletAccount, ChainAdapter } from "@wallet/core";
import type { WalletStore, ActiveSession, BalanceEntry } from "./types.js";

const BALANCE_CACHE_MS = 30_000;

// Stored outside immer state so class instances are never proxied by immer
const adapterRegistry = new Map<ChainId, ChainAdapter>();

function balanceKey(chainId: ChainId, address: string): string {
  return `${chainId}:${address}`;
}

export const useWalletStore: UseBoundStore<StoreApi<WalletStore>> = create<WalletStore>()(
  persist(
    immer((set, get) => ({
      wallets: [],
      activeWalletId: null,
      session: null,
      balances: {},
      transactions: {},
      hiddenChainsByWallet: {},

      addWallet: (wallet) => {
        set((s) => {
          s.wallets.push(wallet);
          if (!s.activeWalletId) s.activeWalletId = wallet.id;
        });
      },

      removeWallet: (id) => {
        set((s) => {
          s.wallets = s.wallets.filter((w) => w.id !== id);
          delete s.hiddenChainsByWallet[id];
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

      setChainVisibility: (chainId, visible) => {
        set((s) => {
          const walletId = s.activeWalletId;
          if (!walletId) return;
          if (!s.hiddenChainsByWallet[walletId]) s.hiddenChainsByWallet[walletId] = [];
          const list = s.hiddenChainsByWallet[walletId]!;
          if (visible) {
            s.hiddenChainsByWallet[walletId] = list.filter((id) => id !== chainId);
          } else if (!list.includes(chainId)) {
            list.push(chainId);
          }
        });
      },

      registerAdapter: (adapter) => {
        adapterRegistry.set(adapter.chainId, adapter);
      },

      getAdapter: (chainId) => adapterRegistry.get(chainId),

      refreshBalance: async (account) => {
        const adapter = adapterRegistry.get(account.chainId);
        if (!adapter) return;

        const key = balanceKey(account.chainId, account.address);
        const cached = get().balances[key];
        if (cached && Date.now() - cached.lastUpdated < BALANCE_CACHE_MS) return;

        try {
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
        } catch {
          // RPC unavailable — leave balance as-is; UI shows "···" placeholder
        }
      },

      refreshAllBalances: async () => {
        const accounts = get().getActiveAccounts();
        await Promise.allSettled(accounts.map((acc) => get().refreshBalance(acc)));
      },

      sendTransaction: async (account, to, value, tokenAddress) => {
        const { session } = get();
        if (!session) throw new Error("Wallet is locked — unlock before sending");

        const adapter = adapterRegistry.get(account.chainId);
        if (!adapter) throw new Error(`No adapter registered for chain ${account.chainId}`);

        const derive = ED25519_CHAINS.has(account.chainId) ? deriveEd25519Key : deriveKey;
        const { privateKey } = derive(session.seedBytes, account.derivationPath);
        const { hash } = await adapter.sendTransaction({
          from: account.address,
          to,
          value,
          privateKey,
          ...(tokenAddress !== undefined ? { tokenAddress } : {}),
        });

        await get().refreshBalance(account);
        return hash;
      },

      getBalance: (chainId, address) => get().balances[balanceKey(chainId, address)],

      getTransactions: (chainId, address) => get().transactions[balanceKey(chainId, address)] ?? [],
    })),
    {
      name: "crypto-wallet-v1",
      // Only persist wallet metadata — session (seed bytes) and cached data stay transient
      partialize: (state) => ({
        wallets: state.wallets,
        activeWalletId: state.activeWalletId,
        hiddenChainsByWallet: state.hiddenChainsByWallet,
      }),
    },
  ),
);
