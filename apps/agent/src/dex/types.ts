import type { DexName, TokenInfo } from "@mantle-edge/shared";

/** A price quote for swapping `amountIn` of `tokenIn` into `tokenOut` on a given DEX. */
export interface DexQuote {
  dex: DexName;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amountIn: bigint;
  amountOut: bigint;
  /** Human-readable price of tokenOut per 1 tokenIn. */
  price: number;
  /** Adapter-specific routing data required to execute the swap. */
  route: unknown;
}

export interface SwapOptions {
  /** Maximum acceptable slippage from the quoted amountOut, in basis points. */
  slippageBps: number;
  /** Address that should receive the output tokens. */
  recipient: string;
  /** Transaction deadline, in seconds from now. Defaults to 600 (10 minutes). */
  deadlineSeconds?: number;
}

export interface SwapResult {
  txHash: string;
  amountOut: bigint;
}

/** Common interface implemented by each DEX integration. */
export interface DexAdapter {
  readonly name: DexName;
  getQuote(tokenIn: TokenInfo, tokenOut: TokenInfo, amountIn: bigint): Promise<DexQuote | null>;
  swap(quote: DexQuote, opts: SwapOptions): Promise<SwapResult>;
}
