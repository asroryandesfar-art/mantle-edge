import { formatUnits } from "ethers";

/** Computes the human-readable price of tokenOut per 1 tokenIn. */
export function computePrice(
  amountIn: bigint,
  amountOut: bigint,
  decimalsIn: number,
  decimalsOut: number,
): number {
  if (amountIn === 0n) return 0;
  const inFloat = Number(formatUnits(amountIn, decimalsIn));
  const outFloat = Number(formatUnits(amountOut, decimalsOut));
  return outFloat / inFloat;
}

/** Reduces `amountOut` by `slippageBps` basis points to derive a minimum acceptable output. */
export function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps >= 10_000) {
    throw new Error(`slippageBps must be in [0, 10000), got ${slippageBps}`);
  }
  return (amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
}

/** Unix timestamp `secondsFromNow` seconds in the future, suitable for swap deadlines. */
export function deadlineFromNow(secondsFromNow: number): number {
  return Math.floor(Date.now() / 1000) + secondsFromNow;
}
