import {
  createPublicClient,
  createWalletClient,
  http,
  publicActions,
  keccak256,
  encodeFunctionData,
  type Chain,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { secp256k1 } from "@noble/curves/secp256k1";
import type { ChainAdapter, TokenBalance, Transaction as WalletTx, SendParams, SendResult } from "@wallet/core";

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

interface EtherscanTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  timeStamp: string;
  isError: string;
  blockNumber: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
}

export interface EVMAdapterConfig {
  chain: Chain;
  rpcUrl: string;
  walletChainId?: string;
  trackedTokens?: Address[];
  explorerApiBase?: string;
  explorerApiKey?: string;
  txProxyUrl?: string;
}

export class EVMAdapter implements ChainAdapter {
  readonly chainId: string;
  readonly name: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly explorerUrl: string;

  private readonly client;
  private readonly trackedTokens: Address[];
  private readonly viemChain: Chain;
  private readonly explorerApiBase: string | undefined;
  private readonly explorerApiKey: string | undefined;
  private readonly txProxyUrl: string | undefined;

  constructor(config: EVMAdapterConfig) {
    this.viemChain = config.chain;
    this.chainId = config.walletChainId ?? config.chain.name.toLowerCase().replace(/\s+/g, "-");
    this.name = config.chain.name;
    this.symbol = config.chain.nativeCurrency.symbol;
    this.decimals = config.chain.nativeCurrency.decimals;
    this.explorerUrl = config.chain.blockExplorers?.default.url ?? "";
    this.trackedTokens = config.trackedTokens ?? [];
    this.explorerApiBase = config.explorerApiBase;
    this.explorerApiKey = config.explorerApiKey;
    this.txProxyUrl = config.txProxyUrl;
    this.client = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    });
  }

  derivationPath(accountIndex = 0): string {
    return `m/44'/60'/${accountIndex}'/0/0`;
  }

  deriveAddress(publicKey: Uint8Array): string {
    const point = secp256k1.ProjectivePoint.fromHex(publicKey);
    const uncompressed = point.toRawBytes(false);
    const hash = keccak256(uncompressed.slice(1) as Uint8Array);
    return `0x${hash.slice(-40)}`;
  }

  validateAddress(address: string): boolean {
    return /^0x[0-9a-fA-F]{40}$/.test(address);
  }

  async getBalance(address: string): Promise<bigint> {
    return this.client.getBalance({ address: address as Address });
  }

  async getTokenBalances(address: string): Promise<TokenBalance[]> {
    if (this.trackedTokens.length === 0) return [];

    const results = await Promise.allSettled(
      this.trackedTokens.map(async (contractAddress) => {
        const [balance, decimals, symbol, name] = await Promise.all([
          this.client.readContract({
            address: contractAddress,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address as Address],
          }),
          this.client.readContract({ address: contractAddress, abi: ERC20_ABI, functionName: "decimals" }),
          this.client.readContract({ address: contractAddress, abi: ERC20_ABI, functionName: "symbol" }),
          this.client.readContract({ address: contractAddress, abi: ERC20_ABI, functionName: "name" }),
        ]);
        return { symbol, name, decimals, balance, contractAddress } satisfies TokenBalance;
      }),
    );

    return (results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<TokenBalance>[]).map(
      (r) => r.value,
    );
  }

  async sendTransaction(params: SendParams): Promise<SendResult> {
    const privKeyHex = `0x${Array.from(params.privateKey).map((b) => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
    const account = privateKeyToAccount(privKeyHex);

    const walletClient = createWalletClient({
      account,
      chain: this.viemChain,
      transport: http(this.client.transport.url as string | undefined),
    }).extend(publicActions);

    let hash: `0x${string}`;

    if (params.tokenAddress) {
      hash = await walletClient.writeContract({
        address: params.tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [params.to as Address, params.value],
      });
    } else {
      hash = await walletClient.sendTransaction({
        to: params.to as Address,
        value: params.value,
      });
    }

    return { hash };
  }

  async getTransactions(address: string, limit = 25): Promise<WalletTx[]> {
    if (!this.explorerApiBase) return [];

    try {
      let url: string;
      if (this.txProxyUrl) {
        // Route through the app's server-side proxy to avoid browser CORS blocks
        const proxy = new URL(this.txProxyUrl, typeof window !== "undefined" ? window.location.origin : "http://localhost");
        proxy.searchParams.set("apiBase", this.explorerApiBase);
        proxy.searchParams.set("address", address);
        proxy.searchParams.set("limit", String(limit));
        if (this.explorerApiKey) proxy.searchParams.set("apiKey", this.explorerApiKey);
        url = proxy.toString();
      } else {
        const keyParam = this.explorerApiKey ? `&apikey=${this.explorerApiKey}` : "";
        url =
          `${this.explorerApiBase}/api?module=account&action=txlist` +
          `&address=${address}&startblock=0&endblock=99999999` +
          `&page=1&offset=${limit}&sort=desc${keyParam}`;
      }

      const res = await fetch(url);
      const json = (await res.json()) as { status: string; result: EtherscanTx[] | string };

      if (json.status !== "1" || !Array.isArray(json.result)) return [];

      return json.result.map((tx) => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to || null,
        value: BigInt(tx.value),
        fee: BigInt(tx.gasUsed) * BigInt(tx.gasPrice),
        timestamp: Number(tx.timeStamp),
        status: tx.isError === "0" ? ("confirmed" as const) : ("failed" as const),
        direction: tx.from.toLowerCase() === address.toLowerCase() ? ("out" as const) : ("in" as const),
        blockNumber: Number(tx.blockNumber),
      }));
    } catch {
      return [];
    }
  }

  async estimateFee(from: string, to: string, value: bigint, tokenAddress?: string): Promise<bigint> {
    try {
      const data = tokenAddress
        ? encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [to as Address, value] })
        : undefined;

      const [gasLimit, gasPrice] = await Promise.all([
        this.client.estimateGas({
          account: from as Address,
          to: (tokenAddress ?? to) as Address,
          value: tokenAddress ? undefined : value,
          data,
        }),
        this.client.getGasPrice(),
      ]);

      return gasLimit * gasPrice;
    } catch {
      return 0n;
    }
  }
}
