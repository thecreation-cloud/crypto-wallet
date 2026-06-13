import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  Ed25519PublicKey,
  AccountAddress,
  SimpleTransaction,
} from "@aptos-labs/ts-sdk";
import type { ChainAdapter, TokenBalance, Transaction as WalletTx, SendParams, SendResult } from "@wallet/core";

const APTOS_DECIMALS = 8;
const APTOS_COIN_TYPE = "0x1::aptos_coin::AptosCoin";

export interface AptosAdapterConfig {
  network?: Network;
  nodeUrl?: string;
}

export class AptosAdapter implements ChainAdapter {
  readonly chainId = "aptos";
  readonly name = "Aptos";
  readonly symbol = "APT";
  readonly decimals = APTOS_DECIMALS;
  readonly explorerUrl = "https://explorer.aptoslabs.com";

  private readonly aptos: Aptos;
  private readonly network: Network;

  constructor(config: AptosAdapterConfig = {}) {
    this.network = config.network ?? Network.MAINNET;
    const aptosConfig = new AptosConfig({ network: this.network });
    this.aptos = new Aptos(aptosConfig);
  }

  derivationPath(accountIndex = 0): string {
    return `m/44'/637'/${accountIndex}'/0'/0'`;
  }

  deriveAddress(publicKey: Uint8Array): string {
    const pubKey = new Ed25519PublicKey(publicKey);
    return pubKey.authKey().derivedAddress().toString();
  }

  validateAddress(address: string): boolean {
    try {
      AccountAddress.from(address);
      return true;
    } catch {
      return false;
    }
  }

  async getBalance(address: string): Promise<bigint> {
    try {
      const balance = await this.aptos.getAccountCoinAmount({
        accountAddress: address,
        coinType: APTOS_COIN_TYPE,
      });
      return BigInt(balance);
    } catch {
      return 0n;
    }
  }

  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    try {
      const resources = await this.aptos.getAccountCoinsData({ accountAddress: address });
      return resources
        .filter((coin) => coin.asset_type !== APTOS_COIN_TYPE)
        .map((coin) => ({
          symbol: coin.metadata?.symbol ?? coin.asset_type?.split("::").pop() ?? "UNKNOWN",
          name: coin.metadata?.name ?? coin.asset_type ?? "Unknown Token",
          decimals: coin.metadata?.decimals ?? 8,
          balance: BigInt(coin.amount),
          contractAddress: coin.asset_type ?? undefined,
        }));
    } catch {
      return [];
    }
  }

  async sendTransaction(params: SendParams): Promise<SendResult> {
    const privKey = new Ed25519PrivateKey(params.privateKey);
    const account = Account.fromPrivateKey({ privateKey: privKey });

    const txn: SimpleTransaction = await this.aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: "0x1::aptos_account::transfer",
        functionArguments: [AccountAddress.from(params.to), params.value],
      },
    });

    const signedTxn = await this.aptos.signAndSubmitTransaction({
      signer: account,
      transaction: txn,
    });

    const result = await this.aptos.waitForTransaction({ transactionHash: signedTxn.hash });
    return { hash: result.hash };
  }

  async getTransactions(address: string, limit = 25): Promise<WalletTx[]> {
    try {
      const txns = await this.aptos.getAccountTransactions({
        accountAddress: address,
        options: { limit },
      });

      return txns
        .map((tx): WalletTx | null => {
          const t = tx as {
            hash: string;
            sender?: string;
            timestamp?: string;
            success?: boolean;
            gas_used?: string;
            gas_unit_price?: string;
            payload?: { function?: string; arguments?: string[] };
          };
          if (!t.hash) return null;

          const fromAddr = t.sender ?? "";
          const fee = BigInt(t.gas_used ?? 0) * BigInt(t.gas_unit_price ?? 0);
          const toAddr = t.payload?.arguments?.[0] ?? null;
          const valueStr = t.payload?.arguments?.[1] ?? "0";
          const value = BigInt(valueStr);

          return {
            hash: t.hash,
            from: fromAddr,
            to: toAddr,
            value,
            fee,
            timestamp: Math.floor(Number(t.timestamp ?? 0) / 1_000_000),
            status: t.success ? ("confirmed" as const) : ("failed" as const),
            direction: fromAddr.toLowerCase() === address.toLowerCase() ? ("out" as const) : ("in" as const),
          };
        })
        .filter((tx): tx is WalletTx => tx !== null);
    } catch {
      return [];
    }
  }
}

export function createAptosAdapter(): AptosAdapter {
  return new AptosAdapter();
}

export function createAptosTestnetAdapter(): AptosAdapter {
  return new AptosAdapter({ network: Network.TESTNET });
}
