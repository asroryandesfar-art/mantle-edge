/** Splits a "BASE/QUOTE" pair string into its two symbols. */
export function splitPair(pair: string): { base: string; quote: string } {
  const [base, quote] = pair.split("/");
  if (!base || !quote) {
    throw new Error(`Invalid trading pair "${pair}", expected "BASE/QUOTE"`);
  }
  return { base, quote };
}

/** Clamps `value` to the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Resolves after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Formats a number with up to `maxDecimals` decimal places, trimming trailing zeros. */
export function formatAmount(value: number, maxDecimals = 6): string {
  if (!Number.isFinite(value)) return "0";
  const fixed = value.toFixed(maxDecimals);
  return fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
}

/** Returns the simple moving average of the last `period` values, or null if there aren't enough. */
export function sma(values: readonly number[], period: number): number | null {
  if (values.length < period) return null;
  const window = values.slice(values.length - period);
  return window.reduce((sum, v) => sum + v, 0) / period;
}

/**
 * Computes the Exponential Moving Average over `period` values, seeded with
 * the SMA of the first `period` values. Returns null if there aren't enough values.
 */
export function ema(values: readonly number[], period: number): number | null {
  if (values.length < period) return null;

  const k = 2 / (period + 1);
  let result = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  for (let i = period; i < values.length; i++) {
    result = values[i]! * k + result * (1 - k);
  }
  return result;
}

/**
 * Computes the Relative Strength Index (RSI) over `period` price changes.
 * Returns null if there aren't enough values.
 */
export function rsi(values: readonly number[], period = 14): number | null {
  if (values.length < period + 1) return null;

  let gains = 0;
  let losses = 0;
  const start = values.length - period - 1;
  for (let i = start + 1; i < values.length; i++) {
    const delta = values[i]! - values[i - 1]!;
    if (delta >= 0) gains += delta;
    else losses += -delta;
  }

  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}
