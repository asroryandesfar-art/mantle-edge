import {
  AgentDecisionSchema,
  clamp,
  rsi,
  sma,
  type AgentDecision,
  type ExecutionVenue,
} from "@mantle-edge/shared";

const SHORT_PERIOD = 10;
const LONG_PERIOD = 30;
const RSI_PERIOD = 14;
const RSI_OVERBOUGHT = 70;
const RSI_OVERSOLD = 30;

export interface StrategyInput {
  /** Trading pair in BASE/QUOTE form, e.g. "MNT/USDT". */
  pair: string;
  /** Where a resulting trade would be executed. */
  venue: ExecutionVenue;
  /** Chronologically ordered close prices (oldest first). */
  closes: readonly number[];
  /** Current reference price (quote per base). */
  currentPrice: number;
  /** Maximum trade notional, in quote-currency terms. */
  maxTradeSizeUsd: number;
}

/**
 * Rule-based momentum strategy: an SMA(10/30) crossover gated by RSI(14) to
 * avoid buying into overbought conditions or selling into oversold ones.
 */
export function decide(input: StrategyInput): AgentDecision {
  const { pair, venue, closes, currentPrice, maxTradeSizeUsd } = input;

  const smaShort = sma(closes, SHORT_PERIOD);
  const smaLong = sma(closes, LONG_PERIOD);
  const prevSmaShort = sma(closes.slice(0, -1), SHORT_PERIOD);
  const prevSmaLong = sma(closes.slice(0, -1), LONG_PERIOD);
  const rsiValue = rsi(closes, RSI_PERIOD);

  const indicators: Record<string, number> = {};
  if (smaShort !== null) indicators.smaShort = smaShort;
  if (smaLong !== null) indicators.smaLong = smaLong;
  if (rsiValue !== null) indicators.rsi = rsiValue;

  let action: AgentDecision["action"] = "HOLD";
  let confidence = 0;
  let reasoning = `Insufficient price history (${closes.length} candles, need ${LONG_PERIOD + 1}); holding.`;

  if (smaShort !== null && smaLong !== null && prevSmaShort !== null && prevSmaLong !== null && rsiValue !== null) {
    const crossedUp = prevSmaShort <= prevSmaLong && smaShort > smaLong;
    const crossedDown = prevSmaShort >= prevSmaLong && smaShort < smaLong;
    const spreadPct = Math.abs(smaShort - smaLong) / smaLong;

    if (crossedUp && rsiValue < RSI_OVERBOUGHT) {
      action = "BUY";
      confidence = clamp(0.5 + spreadPct * 10 + (RSI_OVERBOUGHT - rsiValue) / 200, 0, 1);
      reasoning =
        `SMA(${SHORT_PERIOD}) crossed above SMA(${LONG_PERIOD}) ` +
        `(${smaShort.toFixed(4)} > ${smaLong.toFixed(4)}) with RSI=${rsiValue.toFixed(1)}, not overbought.`;
    } else if (crossedDown && rsiValue > RSI_OVERSOLD) {
      action = "SELL";
      confidence = clamp(0.5 + spreadPct * 10 + (rsiValue - RSI_OVERSOLD) / 200, 0, 1);
      reasoning =
        `SMA(${SHORT_PERIOD}) crossed below SMA(${LONG_PERIOD}) ` +
        `(${smaShort.toFixed(4)} < ${smaLong.toFixed(4)}) with RSI=${rsiValue.toFixed(1)}, not oversold.`;
    } else if (rsiValue >= RSI_OVERBOUGHT) {
      reasoning = `RSI=${rsiValue.toFixed(1)} indicates overbought conditions; holding.`;
    } else if (rsiValue <= RSI_OVERSOLD) {
      reasoning = `RSI=${rsiValue.toFixed(1)} indicates oversold conditions; holding.`;
    } else {
      reasoning = `No SMA crossover (short=${smaShort.toFixed(4)}, long=${smaLong.toFixed(4)}); holding.`;
    }
  }

  const amount = action === "HOLD" || currentPrice <= 0 ? 0 : maxTradeSizeUsd / currentPrice;

  return AgentDecisionSchema.parse({
    timestamp: Date.now(),
    pair,
    action,
    venue,
    confidence,
    price: currentPrice,
    amount,
    reasoning,
    indicators,
  });
}
