import { Contract } from "ethers";
import { AGNI_FINANCE, type TokenInfo } from "@mantle-edge/shared";
import { provider, wallet } from "../chain/provider.js";
import { Erc20 } from "../chain/erc20.js";
import { createLogger } from "../logger.js";
import type { DexAdapter, DexQuote, SwapOptions, SwapResult } from "./types.js";
import { applySlippage, computePrice, deadlineFromNow } from "./utils.js";

const QUOTER_V2_ABI = [
  "function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
] as const;

const SWAP_ROUTER_ABI = [
  "function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)",
] as const;

/** Standard concentrated-liquidity fee tiers (in hundredths of a bip) used by Agni Finance pools. */
const FEE_TIERS = [100, 500, 2500, 10_000] as const;

interface AgniRoute {
  fee: number;
}

const logger = createLogger("dex:agni");

/** Agni Finance — Uniswap V3-style concentrated liquidity AMM on Mantle. */
export class AgniDex implements DexAdapter {
  readonly name = "agni_finance" as const;

  private readonly quoter = new Contract(AGNI_FINANCE.quoterV2, QUOTER_V2_ABI, provider);
  private readonly router = new Contract(AGNI_FINANCE.swapRouter, SWAP_ROUTER_ABI, wallet);

  async getQuote(tokenIn: TokenInfo, tokenOut: TokenInfo, amountIn: bigint): Promise<DexQuote | null> {
    let best: { fee: number; amountOut: bigint } | null = null;

    for (const fee of FEE_TIERS) {
      try {
        const result = await this.quoter.quoteExactInputSingle.staticCall({
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amountIn,
          fee,
          sqrtPriceLimitX96: 0n,
        });
        const amountOut = result[0] as bigint;
        if (amountOut > 0n && (!best || amountOut > best.amountOut)) {
          best = { fee, amountOut };
        }
      } catch {
        // No initialized pool at this fee tier for this pair — try the next one.
      }
    }

    if (!best) return null;

    return {
      dex: this.name,
      tokenIn,
      tokenOut,
      amountIn,
      amountOut: best.amountOut,
      price: computePrice(amountIn, best.amountOut, tokenIn.decimals, tokenOut.decimals),
      route: { fee: best.fee } satisfies AgniRoute,
    };
  }

  async swap(quote: DexQuote, opts: SwapOptions): Promise<SwapResult> {
    const { fee } = quote.route as AgniRoute;
    const amountOutMinimum = applySlippage(quote.amountOut, opts.slippageBps);
    const deadline = deadlineFromNow(opts.deadlineSeconds ?? 600);

    const tokenInContract = new Erc20(quote.tokenIn.address, wallet);
    await tokenInContract.ensureAllowance(wallet.address, AGNI_FINANCE.swapRouter, quote.amountIn);

    const tx = await this.router.exactInputSingle({
      tokenIn: quote.tokenIn.address,
      tokenOut: quote.tokenOut.address,
      fee,
      recipient: opts.recipient,
      deadline,
      amountIn: quote.amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96: 0n,
    });

    logger.info("submitted swap", { dex: this.name, txHash: tx.hash, fee });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Agni Finance swap reverted: ${tx.hash}`);
    }

    return { txHash: tx.hash, amountOut: quote.amountOut };
  }
}
