import { ema, rsi } from "@mantle-edge/shared";
import { bybit } from "../exchanges/bybit.js";
import { createLogger } from "../logger.js";
import { reasonAboutMarket } from "./llm.js";
import type { MarketIndicators, MarketSignal, SignalDirection } from "./types.js";

const logger = createLogger("multiagent:analyst");

/** Assets the MarketAnalystAgent watches, mapped from display pair to Bybit spot symbol. */
const WATCHED_ASSETS: Array<{ pair: string; symbol: string }> = [
  { pair: "BTC/USDT", symbol: "BTCUSDT" },
  { pair: "ETH/USDT", symbol: "ETHUSDT" },
  { pair: "MNT/USDT", symbol: "MNTUSDT" },
];

const KLINE_INTERVAL = "15"; // 15-minute candles
const KLINE_LIMIT = 100;
const VOLUME_WINDOW = 20;

/** Returns the population standard deviation of `values`. */
function stddev(values: readonly number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Z-score of the most recent volume against the trailing `VOLUME_WINDOW` candles. */
function volumeAnomaly(volumes: readonly number[]): number | null {
  if (volumes.length < VOLUME_WINDOW + 1) return null;

  const history = volumes.slice(-(VOLUME_WINDOW + 1), -1);
  const latest = volumes[volumes.length - 1]!;
  const mean = history.reduce((sum, v) => sum + v, 0) / history.length;
  const sd = stddev(history);
  if (sd === 0) return 0;

  return (latest - mean) / sd;
}

/** Deterministic direction/confidence derived purely from indicators (used as the LLM fallback and to seed the prompt). */
function ruleBasedSignal(indicators: MarketIndicators): { direction: SignalDirection; confidence: number } {
  const { rsi14, ema20, ema50 } = indicators;
  if (rsi14 === null || ema20 === null || ema50 === null) {
    return { direction: "WAIT", confidence: 0 };
  }

  const trendUp = ema20 > ema50;
  const trendStrengthPct = Math.abs((ema20 - ema50) / ema50) * 100;

  if (trendUp && rsi14 < 70) {
    const confidence = Math.min(100, 50 + trendStrengthPct * 10 + Math.max(0, 50 - rsi14) * 0.5);
    return { direction: "LONG", confidence: Math.round(confidence) };
  }
  if (!trendUp && rsi14 > 30) {
    const confidence = Math.min(100, 50 + trendStrengthPct * 10 + Math.max(0, rsi14 - 50) * 0.5);
    return { direction: "SHORT", confidence: Math.round(confidence) };
  }

  return { direction: "WAIT", confidence: Math.round(40 + trendStrengthPct * 5) };
}

/** Fetches market data and produces a MarketSignal for a single asset. */
async function analyzeAsset(pair: string, symbol: string): Promise<MarketSignal> {
  const timestamp = Date.now();

  try {
    const [ticker, klines] = await Promise.all([
      bybit.getTicker(symbol),
      bybit.getKlines(symbol, KLINE_INTERVAL, KLINE_LIMIT),
    ]);

    const closes = klines.map((k) => k.close);
    const volumes = klines.map((k) => k.volume);

    const indicators: MarketIndicators = {
      rsi14: rsi(closes, 14),
      ema20: ema(closes, 20),
      ema50: ema(closes, 50),
      volumeAnomaly: volumeAnomaly(volumes),
    };

    const rule = ruleBasedSignal(indicators);
    const reasoning = await reasonAboutMarket({
      asset: pair,
      price: ticker.lastPrice,
      indicators,
      ruleDirection: rule.direction,
      ruleConfidence: rule.confidence,
    });

    const signal: MarketSignal = {
      asset: pair,
      direction: reasoning.direction,
      confidence: reasoning.confidence,
      reasoning: reasoning.reasoning,
      price: ticker.lastPrice,
      indicators,
      timestamp,
    };

    logger.info("Generated market signal", {
      asset: pair,
      direction: signal.direction,
      confidence: signal.confidence,
      price: signal.price,
    });

    return signal;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Failed to analyze asset, returning WAIT signal", { asset: pair, error: message });

    return {
      asset: pair,
      direction: "WAIT",
      confidence: 0,
      reasoning: `Market data unavailable: ${message}`,
      price: 0,
      indicators: { rsi14: null, ema20: null, ema50: null, volumeAnomaly: null },
      timestamp,
    };
  }
}

/** Produces a MarketSignal for every watched asset, never throwing. */
export async function runMarketAnalyst(): Promise<MarketSignal[]> {
  return Promise.all(WATCHED_ASSETS.map((asset) => analyzeAsset(asset.pair, asset.symbol)));
}
