import { ed25519 } from "@noble/curves/ed25519";
import type { ChainAdapter, TokenBalance, Transaction as WalletTx, SendParams, SendResult } from "@wallet/core";

const NEAR_RPC = "https://rpc.mainnet.near.org";
const NEAR_DECIMALS = 24;

interface NearRpcResponse<T> {
  result?: T;
  error?: { code: number; message: string; data?: string };
}

interface NearViewAccount {
  amount: string;
  block_hash: string;
  block_height: number;
  code_hash: string;
  locked: string;
  storage_paid_at: number;
  storage_usage: number;
}

interface NearAccessKeyView {
  nonce: number;
  permission: string | { FunctionCall: object };
  block_hash: string;
  block_height: number;
}

function borshEncodeU64(value: bigint): Uint8Array {
  const buf = new DataView(new ArrayBuffer(8));
  buf.setBigUint64(0, value, true);
  return new Uint8Array(buf.buffer);
}

function borshEncodeU32(value: number): Uint8Array {
  const buf = new DataView(new ArrayBuffer(4));
  buf.setUint32(0, value, true);
  return new Uint8Array(buf.buffer);
}

function borshEncodeString(str: string): Uint8Array {
  const bytes = new TextEncoder().encode(str);
  return new Uint8Array([...borshEncodeU32(bytes.length), ...bytes]);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    out.set(arr, offset);
    offset += arr.length;
  }
  return out;
}

async function sha256Digest(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer);
}

export class NEARAdapter implements ChainAdapter {
  readonly chainId = "near";
  readonly name = "NEAR Protocol";
  readonly symbol = "NEAR";
  readonly decimals = NEAR_DECIMALS;
  readonly explorerUrl = "https://nearblocks.io";

  private readonly rpcUrl: string;

  constructor(rpcUrl?: string) {
    this.rpcUrl = rpcUrl ?? NEAR_RPC;
  }

  derivationPath(accountIndex = 0): string {
    return `m/44'/397'/${accountIndex}'`;
  }

  deriveAddress(publicKey: Uint8Array): string {
    return Array.from(publicKey).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  validateAddress(address: string): boolean {
    if (/^[a-f0-9]{64}$/.test(address)) return true;
    return /^[a-z0-9_-]+(\.[a-z0-9_-]+)*\.(near|testnet)$/.test(address) ||
      /^[a-z0-9_-]{2,64}$/.test(address);
  }

  async getBalance(address: string): Promise<bigint> {
    const result = await this.rpc<NearViewAccount>("query", {
      request_type: "view_account",
      finality: "final",
      account_id: address,
    });
    return BigInt(result.amount);
  }

  async getTokenBalances(_address: string): Promise<TokenBalance[]> {
    return [];
  }

  async sendTransaction(params: SendParams): Promise<SendResult> {
    const publicKey = ed25519.getPublicKey(params.privateKey);
    const senderAddress = this.deriveAddress(publicKey);

    const accessKey = await this.rpc<NearAccessKeyView>("query", {
      request_type: "view_access_key",
      finality: "final",
      account_id: senderAddress,
      public_key: `ed25519:${btoa(String.fromCharCode(...publicKey))}`,
    });

    const nonce = accessKey.nonce + 1;
    const { block_hash: blockHash } = await this.rpc<{ block_hash: string }>("block", {
      finality: "final",
    });

    const tx = this.buildTransferTransaction(
      senderAddress,
      publicKey,
      params.to,
      nonce,
      blockHash,
      params.value,
    );

    const hash = await sha256Digest(tx);
    const sig = ed25519.sign(hash, params.privateKey);

    const signedTx = concatBytes(
      tx,
      new Uint8Array([0]),
      publicKey,
      sig,
    );

    const base64Tx = btoa(String.fromCharCode(...signedTx));
    const result = await this.rpc<{ transaction_outcome: { id: string } }>(
      "broadcast_tx_commit",
      [base64Tx],
    );

    return { hash: result.transaction_outcome.id };
  }

  async getTransactions(address: string, limit = 25): Promise<WalletTx[]> {
    const res = await globalThis.fetch(
      `https://api.nearblocks.io/v1/account/${address}/txns?page=1&per_page=${limit}&order=desc`,
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      txns?: Array<{
        transaction_hash: string;
        signer_account_id: string;
        receiver_account_id: string;
        deposit: string;
        transaction_fee: string;
        block_timestamp: string;
        outcomes: { status: boolean };
      }>;
    };

    return (data.txns ?? []).map((tx) => ({
      hash: tx.transaction_hash,
      from: tx.signer_account_id,
      to: tx.receiver_account_id,
      value: BigInt(tx.deposit),
      fee: BigInt(tx.transaction_fee),
      timestamp: Math.floor(Number(tx.block_timestamp) / 1_000_000_000),
      status: tx.outcomes.status ? ("confirmed" as const) : ("failed" as const),
      direction: tx.signer_account_id === address ? ("out" as const) : ("in" as const),
    }));
  }

  private buildTransferTransaction(
    sender: string,
    publicKey: Uint8Array,
    receiver: string,
    nonce: number,
    blockHash: string,
    amount: bigint,
  ): Uint8Array {
    const senderBytes = borshEncodeString(sender);
    const keyTypeBytes = new Uint8Array([0]);
    const keyBytes = new Uint8Array([...keyTypeBytes, ...publicKey]);
    const nonceBytes = borshEncodeU64(BigInt(nonce));
    const receiverBytes = borshEncodeString(receiver);
    const blockHashBytes = Uint8Array.from(atob(blockHash), (c) => c.charCodeAt(0));

    const actionCount = borshEncodeU32(1);
    const actionType = new Uint8Array([3]);
    const depositBytes = new Uint8Array(16);
    const view = new DataView(depositBytes.buffer);
    const lo = amount & 0xffffffffffffffffn;
    const hi = amount >> 64n;
    view.setBigUint64(0, lo, true);
    view.setBigUint64(8, hi, true);

    return concatBytes(
      senderBytes,
      keyBytes,
      nonceBytes,
      receiverBytes,
      blockHashBytes,
      actionCount,
      actionType,
      depositBytes,
    );
  }

  private async rpc<T>(method: string, params: object | unknown[]): Promise<T> {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: "1",
      method,
      params: Array.isArray(params) ? params : [params],
    });

    const res = await globalThis.fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (!res.ok) throw new Error(`NEAR RPC error ${res.status}`);
    const data = (await res.json()) as NearRpcResponse<T>;
    if (data.error) throw new Error(`NEAR RPC: ${data.error.message} - ${data.error.data ?? ""}`);
    if (!data.result) throw new Error("NEAR RPC: empty result");
    return data.result;
  }
}

export function createNEARAdapter(rpcUrl?: string): NEARAdapter {
  return new NEARAdapter(rpcUrl);
}
