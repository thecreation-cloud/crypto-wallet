import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import type { ChainAdapter, TokenBalance, Transaction as WalletTx, SendParams, SendResult } from "@wallet/core";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

export interface SolanaAdapterConfig {
  rpcUrl: string;
  cluster?: "mainnet-beta" | "devnet" | "testnet";
}

export class SolanaAdapter implements ChainAdapter {
  readonly chainId = "solana";
  readonly name = "Solana";
  readonly symbol = "SOL";
  readonly decimals = 9;
  readonly explorerUrl = "https://solscan.io";

  private readonly connection: Connection;

  constructor(config: SolanaAdapterConfig) {
    this.connection = new Connection(config.rpcUrl, "confirmed");
  }

  derivationPath(accountIndex = 0): string {
    return `m/44'/501'/${accountIndex}'/0'`;
  }

  deriveAddress(publicKey: Uint8Array): string {
    return new PublicKey(publicKey).toBase58();
  }

  validateAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  async getBalance(address: string): Promise<bigint> {
    const lamports = await this.connection.getBalance(new PublicKey(address));
    return BigInt(lamports);
  }

  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(new PublicKey(address), {
      programId: TOKEN_PROGRAM_ID,
    });

    return tokenAccounts.value.map((account) => {
      const info = account.account.data.parsed.info as {
        mint: string;
        tokenAmount: { amount: string; decimals: number; uiAmount: number };
      };
      return {
        symbol: info.mint.slice(0, 6),
        name: info.mint,
        decimals: info.tokenAmount.decimals,
        balance: BigInt(info.tokenAmount.amount),
        contractAddress: info.mint,
      };
    });
  }

  async sendTransaction(params: SendParams): Promise<SendResult> {
    const keypair = Keypair.fromSecretKey(params.privateKey);
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(params.to),
        lamports: Number(params.value),
      }),
    );

    const hash = await sendAndConfirmTransaction(this.connection, transaction, [keypair]);
    return { hash };
  }

  async getTransactions(address: string, limit = 25): Promise<WalletTx[]> {
    const signatures = await this.connection.getSignaturesForAddress(new PublicKey(address), { limit });

    const txs = await Promise.allSettled(
      signatures.map(async (sig) => {
        const tx = await this.connection.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
        if (!tx) return null;

        const meta = tx.meta;
        const message = tx.transaction.message;
        const accountKeys = message.accountKeys;
        const fromKey = accountKeys[0]?.pubkey.toBase58() ?? "";
        const toKey = accountKeys[1]?.pubkey.toBase58() ?? null;
        const preBalance = meta?.preBalances[0] ?? 0;
        const postBalance = meta?.postBalances[0] ?? 0;
        const fee = BigInt(meta?.fee ?? 0);
        const valueLamports = BigInt(Math.abs(preBalance - postBalance));

        return {
          hash: sig.signature,
          from: fromKey,
          to: toKey,
          value: valueLamports > fee ? valueLamports - fee : 0n,
          fee,
          timestamp: sig.blockTime ?? 0,
          status: sig.err ? ("failed" as const) : ("confirmed" as const),
          direction: fromKey === address ? ("out" as const) : ("in" as const),
          blockNumber: tx.slot,
        } satisfies WalletTx;
      }),
    );

    return txs
      .filter((r): r is PromiseFulfilledResult<WalletTx | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((tx): tx is WalletTx => tx !== null);
  }
}

export function createSolanaAdapter(rpcUrl: string): SolanaAdapter {
  return new SolanaAdapter({ rpcUrl });
}

export function createSolanaDevnetAdapter(): SolanaAdapter {
  return new SolanaAdapter({ rpcUrl: "https://api.devnet.solana.com", cluster: "devnet" });
}
