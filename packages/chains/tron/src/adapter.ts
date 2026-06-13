import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { sha256 } from "@noble/hashes/sha256";
import type { ChainAdapter, TokenBalance, Transaction as WalletTx, SendParams, SendResult } from "@wallet/core";

const TRON_GRID_URL = "https://api.trongrid.io";
const ADDRESS_PREFIX = 0x41;
const TRX_DECIMALS = 6;

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const normalized = hex.length % 2 ? "0" + hex : hex;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function base58Encode(buf: Uint8Array): string {
  let num = BigInt("0x" + (toHex(buf) || "00"));
  let result = "";
  while (num > 0n) {
    result = (BASE58_ALPHABET[Number(num % 58n)] ?? "") + result;
    num /= 58n;
  }
  for (const byte of buf) {
    if (byte !== 0) break;
    result = "1" + result;
  }
  return result;
}

function base58Decode(str: string): Uint8Array {
  let num = 0n;
  for (const char of str) {
    const idx = BASE58_ALPHABET.indexOf(char);
    if (idx < 0) throw new Error("Invalid base58 character");
    num = num * 58n + BigInt(idx);
  }
  const hex = num.toString(16);
  const bytes = fromHex(hex.length % 2 ? "0" + hex : hex);
  const leading = str.match(/^1*/)?.[0].length ?? 0;
  return new Uint8Array([...new Uint8Array(leading), ...bytes]);
}

function addressToBase58Check(addressBytes: Uint8Array): string {
  const checksum = sha256(sha256(addressBytes)).slice(0, 4);
  return base58Encode(new Uint8Array([...addressBytes, ...checksum]));
}

function base58CheckToHex(address: string): string {
  const decoded = base58Decode(address);
  return toHex(decoded.slice(0, 21));
}

interface TronGridAccount {
  balance?: number;
  trc20?: Array<Record<string, string>>;
}

interface TronGridTxList {
  data: Array<{
    txID: string;
    raw_data: {
      contract: Array<{
        parameter: {
          value: {
            owner_address: string;
            to_address: string;
            amount?: number;
          };
        };
      }>;
      timestamp: number;
    };
    ret?: Array<{ contractRet: string }>;
  }>;
}

export class TronAdapter implements ChainAdapter {
  readonly chainId = "tron";
  readonly name = "Tron";
  readonly symbol = "TRX";
  readonly decimals = TRX_DECIMALS;
  readonly explorerUrl = "https://tronscan.org/#";

  private readonly apiKey?: string;

  constructor(apiKey?: string) {
    if (apiKey !== undefined) this.apiKey = apiKey;
  }

  derivationPath(accountIndex = 0): string {
    return `m/44'/195'/${accountIndex}'/0/0`;
  }

  deriveAddress(publicKey: Uint8Array): string {
    const point = secp256k1.ProjectivePoint.fromHex(publicKey);
    const uncompressed = point.toRawBytes(false);
    const hash = keccak_256(uncompressed.slice(1));
    const addressBytes = new Uint8Array([ADDRESS_PREFIX, ...hash.slice(12)]);
    return addressToBase58Check(addressBytes);
  }

  validateAddress(address: string): boolean {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return false;
    try {
      const decoded = base58Decode(address);
      if (decoded.length !== 25) return false;
      const payload = decoded.slice(0, 21);
      const checksum = decoded.slice(21);
      const computed = sha256(sha256(payload)).slice(0, 4);
      return toHex(checksum) === toHex(computed);
    } catch {
      return false;
    }
  }

  async getBalance(address: string): Promise<bigint> {
    const data = await this.tronFetch<TronGridAccount>(`/v1/accounts/${address}`);
    return BigInt(data.balance ?? 0);
  }

  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    const data = await this.tronFetch<TronGridAccount>(`/v1/accounts/${address}`);
    if (!data.trc20) return [];

    return data.trc20.flatMap((tokenMap) =>
      Object.entries(tokenMap).map(([contractAddress, balance]) => ({
        symbol: contractAddress.slice(0, 6),
        name: contractAddress,
        decimals: 6,
        balance: BigInt(balance),
        contractAddress,
      })),
    );
  }

  async sendTransaction(params: SendParams): Promise<SendResult> {
    const senderHex = base58CheckToHex(params.from);
    const recipientHex = base58CheckToHex(params.to);

    const createRes = await this.tronPost<{
      txID: string;
      raw_data: object;
      raw_data_hex: string;
    }>("/wallet/createtransaction", {
      owner_address: senderHex,
      to_address: recipientHex,
      amount: Number(params.value),
      visible: false,
    });

    const txIdBytes = fromHex(createRes.txID);
    const sig = secp256k1.sign(txIdBytes, params.privateKey);
    const sigBytes = sig.toCompactRawBytes();
    const v = sig.recovery ? "01" : "00";
    const signature = toHex(sigBytes) + v;

    await this.tronPost("/wallet/broadcasttransaction", {
      ...createRes,
      signature: [signature],
      visible: false,
    });

    return { hash: createRes.txID };
  }

  async getTransactions(address: string, limit = 25): Promise<WalletTx[]> {
    const data = await this.tronFetch<TronGridTxList>(
      `/v1/accounts/${address}/transactions?limit=${limit}`,
    );

    return data.data.map((tx) => {
      const contract = tx.raw_data.contract[0];
      const value = contract?.parameter.value;
      const fromAddr = value?.owner_address ?? "";
      const toAddr = value?.to_address ?? "";
      const amount = BigInt(value?.amount ?? 0);
      const succeeded = tx.ret?.[0]?.contractRet === "SUCCESS";

      return {
        hash: tx.txID,
        from: fromAddr,
        to: toAddr || null,
        value: amount,
        fee: 0n,
        timestamp: Math.floor(tx.raw_data.timestamp / 1000),
        status: succeeded ? ("confirmed" as const) : ("failed" as const),
        direction: fromAddr.toLowerCase() === base58CheckToHex(address).toLowerCase() ? ("out" as const) : ("in" as const),
      };
    });
  }

  private headers(): Record<string, string> {
    return this.apiKey ? { "TRON-PRO-API-KEY": this.apiKey } : {};
  }

  private async tronFetch<T>(path: string): Promise<T> {
    const res = await globalThis.fetch(`${TRON_GRID_URL}${path}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`TronGrid error ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  private async tronPost<T>(path: string, body: object): Promise<T> {
    const res = await globalThis.fetch(`${TRON_GRID_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`TronGrid error ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }
}

export function createTronAdapter(apiKey?: string): TronAdapter {
  return new TronAdapter(apiKey);
}
