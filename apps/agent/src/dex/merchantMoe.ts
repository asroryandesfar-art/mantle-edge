import { Contract } from "ethers";
import { MANTLE_TOKENS, MERCHANT_MOE, type TokenInfo } from "@mantle-edge/shared";
import { provider, wallet } from "../chain/provider.js";
import { Erc20 } from "../chain/erc20.js";
import { createLogger } from "../logger.js";
import type { DexAdapter, DexQuote, SwapOptions, SwapResult } from "./types.js";
import { applySlippage, computePrice, deadlineFromNow } from "./utils.js";

const LB_QUOTER_ABI = [
  "function findBestPathFromAmountIn(address[] route, uint128 amountIn) view returns (tuple(address[] route, address[] pairs, uint256[] binSteps, uint8[] versions, uint128[] amounts, uint128[] virtualAmountsWithoutSlippage, uint128[] fees) quote)",
] as const;

const LB_ROUTER_ABI = [
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, tuple(uint256[] pairBinSteps, uint8[] versions, address[] tokenPath) path, address to, uint256 deadline) returns (uint256 amountOut)",
] as const;

interface LbQuoteResult {
  route: string[];
  pairs: string[];
  binSteps: bigint[];
  versions: number[];
  amounts: bigint[];
  virtualAmountsWithoutSlippage: bigint[];
  fees: bigint[];
}

interface MerchantMoeRoute {
  pairBinSteps: bigint[];
  versions: number[];
  tokenPath: string[];
}

const logger = createLogger("dex:merchant_moe");

/** Merchant Moe — Trader Joe Liquidity Book v2.2 fork on Mantle. */
export class MerchantMoeDex implements DexAdapter {
  readonly name = "merchant_moe" as const;

  private readonly quoter = new Contract(MERCHANT_MOE.lbQuoter, LB_QUOTER_ABI, provider);
  private readonly router = new Contract(MERCHANT_MOE.lbRouter, LB_ROUTER_ABI, wallet);

  async getQuote(tokenIn: TokenInfo, tokenOut: TokenInfo, amountIn: bigint): Promise<DexQuote | null> {
    let result = await this.tryRoute([tokenIn.address, tokenOut.address], amountIn);

    const wmnt = MANTLE_TOKENS.WMNT.address;
    if (!result && tokenIn.address !== wmnt && tokenOut.address !== wmnt) {
      result = await this.tryRoute([tokenIn.address, wmnt, tokenOut.address], amountIn);
    }

    if (!result) return null;

    const amountOut = result.amounts[result.amounts.length - 1]!;

    return {
      dex: this.name,
      tokenIn,
      tokenOut,
      amountIn,
      amountOut,
      price: computePrice(amountIn, amountOut, tokenIn.decimals, tokenOut.decimals),
      route: {
        pairBinSteps: result.binSteps,
        versions: result.versions,
        tokenPath: result.route,
      } satisfies MerchantMoeRoute,
    };
  }

  private async tryRoute(route: string[], amountIn: bigint): Promise<LbQuoteResult | null> {
    try {
      const result = (await this.quoter.findBestPathFromAmountIn(route, amountIn)) as LbQuoteResult;
      const amountOut = result.amounts[result.amounts.length - 1];
      if (!amountOut || amountOut === 0n) return null;
      return result;
    } catch {
      return null;
    }
  }

  async swap(quote: DexQuote, opts: SwapOptions): Promise<SwapResult> {
    const { pairBinSteps, versions, tokenPath } = quote.route as MerchantMoeRoute;
    const amountOutMin = applySlippage(quote.amountOut, opts.slippageBps);
    const deadline = deadlineFromNow(opts.deadlineSeconds ?? 600);

    const tokenInContract = new Erc20(quote.tokenIn.address, wallet);
    await tokenInContract.ensureAllowance(wallet.address, MERCHANT_MOE.lbRouter, quote.amountIn);

    const tx = await this.router.swapExactTokensForTokens(
      quote.amountIn,
      amountOutMin,
      { pairBinSteps, versions, tokenPath },
      opts.recipient,
      deadline,
    );

    logger.info("submitted swap", { dex: this.name, txHash: tx.hash, hops: tokenPath.length - 1 });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Merchant Moe swap reverted: ${tx.hash}`);
    }

    return { txHash: tx.hash, amountOut: quote.amountOut };
  }
}
