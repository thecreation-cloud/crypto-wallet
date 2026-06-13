import {
  Client,
  Wallet,
  Payment,
  xrpToDrops,
  dropsToXrp,
  convertStringToHex,
  AccountTxTransaction,
} from "xrpl";
import type { ChainAdapter, TokenBalance, Transaction as WalletTx, SendParams, SendResult } from "@wallet/core";

export interface XRPAdapterConfig {
  rpcUrl?: string;
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
    const wallet = Wallet.fromSeed(
      Buffer.from(publicKey).toString("hex"),
      { algorithm: "secp256k1" },
    );
    return wallet.classicAddress;
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
      const balanceDrops = response.result.account_data.Balance;
      return BigInt(balanceDrops);
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
    const privKeyHex = Buffer.from(params.privateKey).toString("hex").toUpperCase();
    const wallet = Wallet.fromSeed(privKeyHex, { algorithm: "secp256k1" });

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
      return { hash: result.result.hash };
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
        .map((item): WalletTx | null => {
          const tx = item.tx as AccountTxTransaction["tx"];
          if (!tx || tx.TransactionType !== "Payment") return null;

          const fromAddr = tx.Account ?? "";
          const toAddr = "Destination" in tx ? (tx.Destination as string) : "";
          const amount = typeof tx.Amount === "string" ? BigInt(tx.Amount) : 0n;
          const fee = BigInt(tx.Fee ?? 0);
          const meta = item.meta as { TransactionResult?: string } | undefined;
          const succeeded = meta?.TransactionResult === "tesSUCCESS";

          return {
            hash: tx.hash ?? "",
            from: fromAddr,
            to: toAddr || null,
            value: amount,
            fee,
            timestamp: "date" in tx ? Math.floor((Number(tx.date ?? 0) + 946684800) * 1) : 0,
            status: succeeded ? ("confirmed" as const) : ("failed" as const),
            direction: fromAddr === address ? ("out" as const) : ("in" as const),
            blockNumber: "ledger_index" in tx ? Number(tx.ledger_index) : undefined,
          };
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
  return new XRPAdapter({ rpcUrl });
}
