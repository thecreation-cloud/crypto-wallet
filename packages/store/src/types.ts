import type { ChainId, StoredWallet, WalletAccount, Transaction, TokenBalance, ChainAdapter } from "@wallet/core";

export interface ActiveSession {
  walletId: string;
  unlockedAt: number;
  seedBytes: Uint8Array;
}

export interface BalanceEntry {
  chainId: ChainId;
  address: string;
  native: bigint;
  tokens: TokenBalance[];
  lastUpdated: number;
}

export interface WalletStore {
  wallets: StoredWallet[];
  activeWalletId: string | null;
  session: ActiveSession | null;
  balances: Record<string, BalanceEntry>;
  transactions: Record<string, Transaction[]>;
  adapters: Map<ChainId, ChainAdapter>;

  addWallet: (wallet: StoredWallet) => void;
  removeWallet: (id: string) => void;
  selectWallet: (id: string) => void;
  getActiveWallet: () => StoredWallet | null;
  getActiveAccounts: () => WalletAccount[];

  unlock: (walletId: string, seedBytes: Uint8Array) => void;
  lock: () => void;
  isUnlocked: () => boolean;

  registerAdapter: (adapter: ChainAdapter) => void;
  getAdapter: (chainId: ChainId) => ChainAdapter | undefined;

  refreshBalance: (account: WalletAccount) => Promise<void>;
  refreshAllBalances: () => Promise<void>;
  sendTransaction: (
    account: WalletAccount,
    to: string,
    value: bigint,
    tokenAddress?: string,
  ) => Promise<string>;

  getBalance: (chainId: ChainId, address: string) => BalanceEntry | undefined;
  getTransactions: (chainId: ChainId, address: string) => Transaction[];
}
