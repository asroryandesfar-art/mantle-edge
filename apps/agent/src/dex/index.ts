import type { TokenInfo } from "@mantle-edge/shared";
import { AgniDex } from "./agni.js";
import { MerchantMoeDex } from "./merchantMoe.js";
import type { DexAdapter, DexQuote } from "./types.js";

export * from "./types.js";
export { AgniDex } from "./agni.js";
export { MerchantMoeDex } from "./merchantMoe.js";

/** All DEX adapters the agent knows how to route swaps through, on Mantle. */
export const dexAdapters: DexAdapter[] = [new MerchantMoeDex(), new AgniDex()];

/**
 * Fetches a quote from every supported DEX and returns the one offering the
 * largest `amountOut`, or null if none of them can route this pair.
 */
export async function getBestQuote(
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
  amountIn: bigint,
): Promise<DexQuote | null> {
  const quotes = await Promise.all(
    dexAdapters.map((adapter) => adapter.getQuote(tokenIn, tokenOut, amountIn).catch(() => null)),
  );

  let best: DexQuote | null = null;
  for (const quote of quotes) {
    if (quote && (!best || quote.amountOut > best.amountOut)) {
      best = quote;
    }
  }
  return best;
}

/** Returns the adapter implementation for a given DEX. */
export function getAdapter(name: DexQuote["dex"]): DexAdapter {
  const adapter = dexAdapters.find((a) => a.name === name);
  if (!adapter) throw new Error(`Unknown DEX adapter: ${name}`);
  return adapter;
}
