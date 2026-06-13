import {
  createPublicClient,
  createWalletClient,
  http,
  publicActions,
  keccak256,
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

export interface EVMAdapterConfig {
  chain: Chain;
  rpcUrl: string;
  walletChainId?: string;
  trackedTokens?: Address[];
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

  constructor(config: EVMAdapterConfig) {
    this.viemChain = config.chain;
    this.chainId = config.walletChainId ?? config.chain.name.toLowerCase().replace(/\s+/g, "-");
    this.name = config.chain.name;
    this.symbol = config.chain.nativeCurrency.symbol;
    this.decimals = config.chain.nativeCurrency.decimals;
    this.explorerUrl = config.chain.blockExplorers?.default.url ?? "";
    this.trackedTokens = config.trackedTokens ?? [];
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
    const privKeyHex = `0x${Buffer.from(params.privateKey).toString("hex")}` as `0x${string}`;
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
    const blockNumber = await this.client.getBlockNumber();
    const fromBlock = blockNumber > BigInt(10_000) ? blockNumber - BigInt(10_000) : 0n;

    const logs = await this.client.getLogs({ fromBlock, toBlock: "latest" }).catch(() => []);
    const addrLogs = logs
      .filter(
        (l) =>
          l.topics.some((t) => t?.toLowerCase().includes(address.slice(2).toLowerCase())),
      )
      .slice(0, limit);

    const blockNums = [...new Set(addrLogs.map((l) => l.blockNumber).filter(Boolean))];
    const blocks = await Promise.allSettled(
      blockNums.map((bn) => this.client.getBlock({ blockNumber: bn! })),
    );
    const timestamps = new Map(
      (blocks.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof this.client.getBlock>>>[])
        .filter((r) => r.value.number != null)
        .map((r) => [r.value.number!.toString(), Number(r.value.timestamp)]),
    );

    return addrLogs.map((log) => ({
      hash: log.transactionHash ?? "",
      from: address,
      to: null,
      value: 0n,
      fee: 0n,
      timestamp: timestamps.get(log.blockNumber?.toString() ?? "") ?? 0,
      status: "confirmed" as const,
      direction: "out" as const,
      blockNumber: Number(log.blockNumber ?? 0),
    }));
  }
}
