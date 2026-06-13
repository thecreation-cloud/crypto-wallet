import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import type { ChainAdapter, TokenBalance, Transaction as WalletTx, SendParams, SendResult } from "@wallet/core";

bitcoin.initEccLib(ecc);

const litecoinNetwork: bitcoin.networks.Network = {
  messagePrefix: "\x19Litecoin Signed Message:\n",
  bech32: "ltc",
  bip32: { public: 0x019da462, private: 0x019d9cfe },
  pubKeyHash: 0x30,
  scriptHash: 0x32,
  wif: 0xb0,
};

const dogecoinNetwork: bitcoin.networks.Network = {
  messagePrefix: "\x19Dogecoin Signed Message:\n",
  bech32: "doge",
  bip32: { public: 0x02facafd, private: 0x02fac398 },
  pubKeyHash: 0x1e,
  scriptHash: 0x16,
  wif: 0x9e,
};

interface BlockchairAddressData {
  data: Record<
    string,
    {
      address: {
        balance: number;
        transaction_count: number;
      };
      transactions: string[];
    }
  >;
}

interface BlockchairTx {
  transaction: {
    hash: string;
    time: string;
    fee: number;
    input_total: number;
    output_total: number;
    block_id: number;
    inputs: Array<{ recipient: string }>;
    outputs: Array<{ recipient: string; value: number }>;
  };
}

export interface UTXOAdapterConfig {
  chainId: string;
  name: string;
  symbol: string;
  decimals: number;
  network: bitcoin.networks.Network;
  coinType: number;
  explorerUrl: string;
  blockchairChain: string;
  addressType?: "p2wpkh" | "p2pkh";
}

export class UTXOAdapter implements ChainAdapter {
  readonly chainId: string;
  readonly name: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly explorerUrl: string;

  private readonly network: bitcoin.networks.Network;
  private readonly coinType: number;
  private readonly blockchairChain: string;
  private readonly addressType: "p2wpkh" | "p2pkh";

  constructor(config: UTXOAdapterConfig) {
    this.chainId = config.chainId;
    this.name = config.name;
    this.symbol = config.symbol;
    this.decimals = config.decimals;
    this.explorerUrl = config.explorerUrl;
    this.network = config.network;
    this.coinType = config.coinType;
    this.blockchairChain = config.blockchairChain;
    this.addressType = config.addressType ?? "p2wpkh";
  }

  derivationPath(accountIndex = 0): string {
    const purpose = this.addressType === "p2wpkh" ? 84 : 44;
    return `m/${purpose}'/${this.coinType}'/${accountIndex}'/0/0`;
  }

  deriveAddress(publicKey: Uint8Array): string {
    const pubkeyBuf = Buffer.from(publicKey);
    if (this.addressType === "p2pkh") {
      const { address } = bitcoin.payments.p2pkh({ pubkey: pubkeyBuf, network: this.network });
      if (!address) throw new Error(`Failed to derive ${this.symbol} P2PKH address`);
      return address;
    }
    const { address } = bitcoin.payments.p2wpkh({ pubkey: pubkeyBuf, network: this.network });
    if (!address) throw new Error(`Failed to derive ${this.symbol} P2WPKH address`);
    return address;
  }

  validateAddress(address: string): boolean {
    try {
      bitcoin.address.toOutputScript(address, this.network);
      return true;
    } catch {
      return false;
    }
  }

  async getBalance(address: string): Promise<bigint> {
    const data = await this.blockchairFetch<BlockchairAddressData>(`/dashboards/address/${address}`);
    const addrData = data.data[address];
    if (!addrData) return 0n;
    return BigInt(addrData.address.balance);
  }

  async getTokenBalances(_address: string): Promise<TokenBalance[]> {
    return [];
  }

  async sendTransaction(params: SendParams): Promise<SendResult> {
    const p2type = this.addressType === "p2wpkh" ? bitcoin.payments.p2wpkh : bitcoin.payments.p2pkh;
    const payment = p2type({
      pubkey: Buffer.from(params.privateKey.slice(1)),
      network: this.network,
    });

    const data = await this.blockchairFetch<BlockchairAddressData>(`/dashboards/address/${params.from}`);
    const addrData = data.data[params.from];
    if (!addrData) throw new Error("Address not found");

    const utxoHashes = addrData.transactions.slice(0, 10);
    const psbt = new bitcoin.Psbt({ network: this.network });
    let inputTotal = 0n;

    for (const txHash of utxoHashes) {
      const rawHex = await this.blockchairRawTx(txHash);
      const tx = bitcoin.Transaction.fromHex(rawHex);
      for (let i = 0; i < tx.outs.length; i++) {
        const out = tx.outs[i];
        if (!out) continue;
        try {
          const outAddr = bitcoin.address.fromOutputScript(out.script, this.network);
          if (outAddr === params.from) {
            if (this.addressType === "p2wpkh") {
              psbt.addInput({
                hash: txHash,
                index: i,
                witnessUtxo: { script: payment.output!, value: out.value },
              });
            } else {
              psbt.addInput({ hash: txHash, index: i, nonWitnessUtxo: Buffer.from(rawHex, "hex") });
            }
            inputTotal += BigInt(out.value);
            if (inputTotal >= params.value + 10_000n) break;
          }
        } catch {
          continue;
        }
      }
      if (inputTotal >= params.value + 10_000n) break;
    }

    if (inputTotal < params.value + 10_000n) throw new Error("Insufficient confirmed balance");

    const fee = 10_000n;
    const change = inputTotal - params.value - fee;

    psbt.addOutput({ address: params.to, value: Number(params.value) });
    if (change > 546n) psbt.addOutput({ address: params.from, value: Number(change) });

    psbt.signAllInputs({
      publicKey: Buffer.from(params.privateKey.slice(1)),
      sign: (hash) => Buffer.from(ecc.sign(hash, params.privateKey)),
    });
    psbt.finalizeAllInputs();

    const rawTx = psbt.extractTransaction().toHex();
    const result = await this.blockchairPush(rawTx);
    return { hash: result };
  }

  async getTransactions(address: string, limit = 25): Promise<WalletTx[]> {
    const data = await this.blockchairFetch<BlockchairAddressData>(`/dashboards/address/${address}`);
    const addrData = data.data[address];
    if (!addrData) return [];

    const txHashes = addrData.transactions.slice(0, limit);
    const txResults = await Promise.allSettled(
      txHashes.map(async (hash): Promise<WalletTx> => {
        const txData = await this.blockchairFetch<{ data: Record<string, BlockchairTx> }>(
          `/dashboards/transaction/${hash}`,
        );
        const tx = txData.data[hash]?.transaction;
        if (!tx) throw new Error("tx not found");

        const fromAddr = tx.inputs[0]?.recipient ?? "";
        const direction = fromAddr === address ? ("out" as const) : ("in" as const);
        const relevantOutput = tx.outputs.find((o) =>
          direction === "out" ? o.recipient !== address : o.recipient === address,
        );

        return {
          hash,
          from: fromAddr,
          to: relevantOutput?.recipient ?? null,
          value: BigInt(relevantOutput?.value ?? 0),
          fee: BigInt(tx.fee),
          timestamp: Math.floor(new Date(tx.time).getTime() / 1000),
          status: "confirmed" as const,
          direction,
          blockNumber: tx.block_id,
        };
      }),
    );

    return txResults
      .filter((r): r is PromiseFulfilledResult<WalletTx> => r.status === "fulfilled")
      .map((r) => r.value);
  }

  private async blockchairFetch<T>(path: string): Promise<T> {
    const res = await globalThis.fetch(
      `https://api.blockchair.com/${this.blockchairChain}${path}?limit=50`,
    );
    if (!res.ok) throw new Error(`Blockchair ${this.symbol} error ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async blockchairRawTx(txHash: string): Promise<string> {
    const res = await globalThis.fetch(
      `https://api.blockchair.com/${this.blockchairChain}/raw/transaction/${txHash}`,
    );
    if (!res.ok) throw new Error(`Blockchair raw tx error ${res.status}`);
    const data = (await res.json()) as { data: Record<string, { raw_transaction: string }> };
    const raw = data.data[txHash]?.raw_transaction;
    if (!raw) throw new Error("Raw tx not found");
    return raw;
  }

  private async blockchairPush(rawTx: string): Promise<string> {
    const res = await globalThis.fetch(
      `https://api.blockchair.com/${this.blockchairChain}/push/transaction`,
      { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `data=${rawTx}` },
    );
    if (!res.ok) throw new Error(`Broadcast failed ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { data: { transaction_hash: string } };
    return data.data.transaction_hash;
  }
}

export function createBitcoinAdapter(): UTXOAdapter {
  return new UTXOAdapter({
    chainId: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    decimals: 8,
    network: bitcoin.networks.bitcoin,
    coinType: 0,
    explorerUrl: "https://blockstream.info",
    blockchairChain: "bitcoin",
    addressType: "p2wpkh",
  });
}

export function createLitecoinAdapter(): UTXOAdapter {
  return new UTXOAdapter({
    chainId: "litecoin",
    name: "Litecoin",
    symbol: "LTC",
    decimals: 8,
    network: litecoinNetwork,
    coinType: 2,
    explorerUrl: "https://blockchair.com/litecoin",
    blockchairChain: "litecoin",
    addressType: "p2wpkh",
  });
}

export function createDogecoinAdapter(): UTXOAdapter {
  return new UTXOAdapter({
    chainId: "dogecoin",
    name: "Dogecoin",
    symbol: "DOGE",
    decimals: 8,
    network: dogecoinNetwork,
    coinType: 3,
    explorerUrl: "https://blockchair.com/dogecoin",
    blockchairChain: "dogecoin",
    addressType: "p2pkh",
  });
}

export function createBitcoinTestnetAdapter(): UTXOAdapter {
  return new UTXOAdapter({
    chainId: "bitcoin-testnet",
    name: "Bitcoin Testnet",
    symbol: "tBTC",
    decimals: 8,
    network: bitcoin.networks.testnet,
    coinType: 1,
    explorerUrl: "https://blockstream.info/testnet",
    blockchairChain: "bitcoin/testnet",
    addressType: "p2wpkh",
  });
}
