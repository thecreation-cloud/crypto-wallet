import { secp256k1 } from "@noble/curves/secp256k1";
import {
  Client,
  Wallet,
  Payment,
  deriveAddress,
  AccountTxTransaction,
} from "xrpl";
import type { ChainAdapter, TokenBalance, Transaction as WalletTx, SendParams, SendResult } from "@wallet/core";

export interface XRPAdapterConfig {
  rpcUrl?: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export class XRPAdapter implements ChainAdapter {
  readonly chainId = "xrp";
  readonly name = "XRP Ledger";
  readonly symbol = "XRP";
  readonly decimals = 6;
  readonly explorerUrl = "https://xrpscan.com";

  private readonly rpcUrl: string;

  constructor(config: XRPAdapterConfig = {}) {
    this.rpcUrl = config.rpcUrl ?? "wss://xrplcluster.com";
  }

  derivationPath(accountIndex = 0): string {
    return `m/44'/144'/${accountIndex}'/0/0`;
  }

  deriveAddress(publicKey: Uint8Array): string {
    return deriveAddress(toHex(publicKey));
  }

  validateAddress(address: string): boolean {
    return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
  }

  async getBalance(address: string): Promise<bigint> {
    const client = new Client(this.rpcUrl);
    try {
      await client.connect();
      const response = await client.request({
        command: "account_info",
        account: address,
        ledger_index: "current",
      });
      return BigInt(response.result.account_data.Balance);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Account not found")) return 0n;
      throw err;
    } finally {
      await client.disconnect();
    }
  }

  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    const client = new Client(this.rpcUrl);
    try {
      await client.connect();
      const response = await client.request({
        command: "account_lines",
        account: address,
        ledger_index: "current",
      });

      return response.result.lines.map((line) => ({
        symbol: line.currency,
        name: line.currency,
        decimals: 6,
        balance: BigInt(Math.round(parseFloat(line.balance) * 1_000_000)),
        contractAddress: `${line.account}:${line.currency}`,
      }));
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Account not found")) return [];
      throw err;
    } finally {
      await client.disconnect();
    }
  }

  async sendTransaction(params: SendParams): Promise<SendResult> {
    const privKeyHex = toHex(params.privateKey);
    const pubKeyBytes = secp256k1.getPublicKey(params.privateKey, true);
    const pubKeyHex = toHex(pubKeyBytes);
    const wallet = new Wallet(pubKeyHex, "00" + privKeyHex);

    const client = new Client(this.rpcUrl);
    try {
      await client.connect();
      const payment: Payment = {
        TransactionType: "Payment",
        Account: wallet.classicAddress,
        Destination: params.to,
        Amount: params.value.toString(),
      };

      const prepared = await client.autofill(payment);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);
      return { hash: result.result.hash ?? "" };
    } finally {
      await client.disconnect();
    }
  }

  async getTransactions(address: string, limit = 25): Promise<WalletTx[]> {
    const client = new Client(this.rpcUrl);
    try {
      await client.connect();
      const response = await client.request({
        command: "account_tx",
        account: address,
        limit,
        ledger_index_min: -1,
        ledger_index_max: -1,
      });

      return response.result.transactions
        .map((item: AccountTxTransaction): WalletTx | null => {
          const tx = item.tx_json;
          if (!tx || tx.TransactionType !== "Payment") return null;

          const fromAddr = tx.Account ?? "";
          const toAddr = tx.Destination ?? null;
          const amount = typeof tx.Amount === "string" ? BigInt(tx.Amount) : 0n;
          const fee = BigInt(tx.Fee ?? 0);
          const meta = item.meta as { TransactionResult?: string } | undefined;
          const succeeded = meta?.TransactionResult === "tesSUCCESS";

          const txResult: WalletTx = {
            hash: item.hash ?? tx.hash ?? "",
            from: fromAddr,
            to: toAddr || null,
            value: amount,
            fee,
            timestamp: tx.date ?? 0,
            status: succeeded ? ("confirmed" as const) : ("failed" as const),
            direction: fromAddr === address ? ("out" as const) : ("in" as const),
          };
          txResult.blockNumber = item.ledger_index;
          return txResult;
        })
        .filter((tx): tx is WalletTx => tx !== null);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Account not found")) return [];
      throw err;
    } finally {
      await client.disconnect();
    }
  }
}

export function createXRPAdapter(rpcUrl?: string): XRPAdapter {
  return new XRPAdapter(rpcUrl !== undefined ? { rpcUrl } : {});
}
