export type ChainId = "ethereum" | "solana" | "bitcoin" | string;

export interface TokenBalance {
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  contractAddress?: string;
  logoUrl?: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string | null;
  value: bigint;
  fee: bigint;
  timestamp: number;
  status: "confirmed" | "pending" | "failed";
  direction: "in" | "out" | "self";
  tokenSymbol?: string;
  tokenDecimals?: number;
  blockNumber?: number;
}

export interface SendParams {
  from: string;
  to: string;
  value: bigint;
  privateKey: Uint8Array;
  tokenAddress?: string;
  memo?: string;
}

export interface SendResult {
  hash: string;
}

export interface ChainAdapter {
  readonly chainId: ChainId;
  readonly name: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly explorerUrl: string;
  getBalance(address: string): Promise<bigint>;
  getTokenBalances(address: string): Promise<TokenBalance[]>;
  sendTransaction(params: SendParams): Promise<SendResult>;
  getTransactions(address: string, limit?: number): Promise<Transaction[]>;
  validateAddress(address: string): boolean;
  deriveAddress(publicKey: Uint8Array): string;
  derivationPath(accountIndex?: number): string;
}

export interface WalletAccount {
  id: string;
  name: string;
  chainId: ChainId;
  address: string;
  publicKey: string;
  derivationPath: string;
  accountIndex: number;
}

export interface StoredWallet {
  id: string;
  name: string;
  encryptedMnemonic: string;
  accounts: WalletAccount[];
  createdAt: number;
}

export interface DerivationResult {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  path: string;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  salt: string;
}
