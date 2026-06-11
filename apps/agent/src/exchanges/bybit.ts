import { createHmac } from "node:crypto";
import { config } from "../config.js";

const RECV_WINDOW = "5000";

interface BybitResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
}

interface TickerListResult {
  list: Array<{
    symbol: string;
    lastPrice: string;
    bid1Price: string;
    ask1Price: string;
    volume24h: string;
  }>;
}

interface KlineListResult {
  list: string[][];
}

interface InstrumentListResult {
  list: Array<{
    symbol: string;
    lotSizeFilter: {
      basePrecision: string;
      quotePrecision: string;
      minOrderQty: string;
      minOrderAmt: string;
    };
  }>;
}

interface OrderCreateResult {
  orderId: string;
  orderLinkId: string;
}

export interface Ticker {
  symbol: string;
  lastPrice: number;
  bid1Price: number;
  ask1Price: number;
  volume24h: number;
}

export interface Kline {
  startTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface InstrumentInfo {
  symbol: string;
  /** Decimal places allowed for the base asset quantity. */
  basePrecision: number;
  /** Decimal places allowed for the quote asset quantity. */
  quotePrecision: number;
  minOrderQty: number;
  minOrderAmt: number;
}

export interface OrderResult {
  orderId: string;
  orderLinkId: string;
}

/** Number of decimal places represented by a step size string such as "0.0001". */
function decimalsFromStep(step: string): number {
  const dot = step.indexOf(".");
  if (dot === -1) return 0;
  return step.length - dot - 1;
}

/** Maps Bybit spot symbols to CoinGecko coin ids, used as a market-data fallback. */
const COINGECKO_IDS: Record<string, string> = {
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  MNTUSDT: "mantle",
};

interface CoingeckoSimplePrice {
  [id: string]: { usd: number; usd_24h_vol?: number };
}

interface CoingeckoMarketChart {
  prices: Array<[number, number]>;
  total_volumes: Array<[number, number]>;
}

/**
 * CoinGecko's free tier rate-limits aggressively (HTTP 429); serialize all
 * requests with a spacing delay so the per-asset Promise.all calls in
 * marketAnalyst don't fire a burst of concurrent requests, and retry once
 * after a longer cooldown if still rate-limited.
 */
const COINGECKO_REQUEST_DELAY_MS = 6_500;
const COINGECKO_RETRY_DELAY_MS = 15_000;
let coingeckoQueue: Promise<unknown> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function coingeckoFetchOnce<T>(url: string): Promise<{ json: T; rateLimited: boolean }> {
  const res = await fetch(url);
  const json = (await res.json()) as T & { status?: { error_code?: number } };
  return { json, rateLimited: res.status === 429 || json.status?.error_code === 429 };
}

function coingeckoFetch<T>(url: string): Promise<T> {
  const result = coingeckoQueue.then(async () => {
    const first = await coingeckoFetchOnce<T>(url);
    if (!first.rateLimited) return first.json;

    await sleep(COINGECKO_RETRY_DELAY_MS);
    const second = await coingeckoFetchOnce<T>(url);
    return second.json;
  });
  coingeckoQueue = result.catch(() => undefined).then(() => sleep(COINGECKO_REQUEST_DELAY_MS));
  return result;
}

/** Minimal Bybit v5 REST client for market data and spot order execution. */
export class BybitClient {
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string = config.bybit.apiKey,
    private readonly apiSecret: string = config.bybit.apiSecret,
    testnet: boolean = config.bybit.testnet,
  ) {
    this.baseUrl = testnet ? "https://api-testnet.bybit.com" : "https://api.bybit.com";
  }

  /** Latest ticker (best bid/ask + last traded price) for a spot symbol, e.g. "MNTUSDT". */
  async getTicker(symbol: string): Promise<Ticker> {
    try {
      const res = await this.publicGet<TickerListResult>("/v5/market/tickers", { category: "spot", symbol });
      const item = res.result.list[0];
      if (!item) throw new Error(`Bybit: no ticker data for ${symbol}`);

      return {
        symbol: item.symbol,
        lastPrice: Number(item.lastPrice),
        bid1Price: Number(item.bid1Price),
        ask1Price: Number(item.ask1Price),
        volume24h: Number(item.volume24h),
      };
    } catch (err) {
      const fallback = await this.coingeckoTicker(symbol);
      if (!fallback) throw err;
      return fallback;
    }
  }

  /** Historical candles, oldest first, for a spot symbol. `interval` is in minutes ("1","5","15","60",...) or "D"/"W"/"M". */
  async getKlines(symbol: string, interval: string, limit = 100): Promise<Kline[]> {
    try {
      const res = await this.publicGet<KlineListResult>("/v5/market/kline", {
        category: "spot",
        symbol,
        interval,
        limit: String(limit),
      });

      return res.result.list
        .map((row) => ({
          startTime: Number(row[0]),
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          volume: Number(row[5]),
        }))
        .reverse(); // Bybit returns newest-first; we want chronological order.
    } catch (err) {
      const fallback = await this.coingeckoKlines(symbol, interval, limit);
      if (!fallback) throw err;
      return fallback;
    }
  }

  /** Best-effort ticker from CoinGecko's public API, used when Bybit is unreachable. Returns `null` for unmapped symbols. */
  private async coingeckoTicker(symbol: string): Promise<Ticker | null> {
    const id = COINGECKO_IDS[symbol];
    if (!id) return null;

    const json = await coingeckoFetch<CoingeckoSimplePrice>(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_vol=true`,
    );
    const price = json[id]?.usd;
    if (price === undefined) throw new Error(`CoinGecko: no price data for ${id}`);

    return {
      symbol,
      lastPrice: price,
      bid1Price: price * 0.9995,
      ask1Price: price * 1.0005,
      volume24h: json[id]?.usd_24h_vol ?? 0,
    };
  }

  /**
   * Best-effort OHLCV candles from CoinGecko's public API, used when Bybit is
   * unreachable. Bucketed from 5-minutely market-chart data into `interval`-minute
   * candles. Returns `null` for unmapped symbols.
   */
  private async coingeckoKlines(symbol: string, interval: string, limit: number): Promise<Kline[] | null> {
    const id = COINGECKO_IDS[symbol];
    if (!id) return null;

    const intervalMs = (Number(interval) || 15) * 60_000;

    const json = await coingeckoFetch<CoingeckoMarketChart>(
      `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=1`,
    );
    if (!json.prices?.length) throw new Error(`CoinGecko: no market chart data for ${id}`);

    const buckets = new Map<number, { prices: number[]; volume: number }>();
    for (const [ts, price] of json.prices) {
      const key = Math.floor(ts / intervalMs);
      const bucket = buckets.get(key) ?? { prices: [], volume: 0 };
      bucket.prices.push(price);
      buckets.set(key, bucket);
    }
    for (const [ts, volume] of json.total_volumes ?? []) {
      const key = Math.floor(ts / intervalMs);
      const bucket = buckets.get(key);
      if (bucket) bucket.volume = volume;
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a - b)
      .map(([key, bucket]) => ({
        startTime: key * intervalMs,
        open: bucket.prices[0]!,
        high: Math.max(...bucket.prices),
        low: Math.min(...bucket.prices),
        close: bucket.prices[bucket.prices.length - 1]!,
        volume: bucket.volume,
      }))
      .slice(-limit);
  }

  /** Lot-size and precision rules for a spot symbol, used to round order quantities. */
  async getInstrumentInfo(symbol: string): Promise<InstrumentInfo> {
    const res = await this.publicGet<InstrumentListResult>("/v5/market/instruments-info", {
      category: "spot",
      symbol,
    });
    const item = res.result.list[0];
    if (!item) throw new Error(`Bybit: no instrument info for ${symbol}`);

    return {
      symbol: item.symbol,
      basePrecision: decimalsFromStep(item.lotSizeFilter.basePrecision),
      quotePrecision: decimalsFromStep(item.lotSizeFilter.quotePrecision),
      minOrderQty: Number(item.lotSizeFilter.minOrderQty),
      minOrderAmt: Number(item.lotSizeFilter.minOrderAmt),
    };
  }

  /**
   * Places a spot market order. For "Buy" orders `qty` is denominated in the
   * quote asset; for "Sell" orders it is denominated in the base asset.
   */
  async placeMarketOrder(params: { symbol: string; side: "Buy" | "Sell"; qty: string }): Promise<OrderResult> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error("Bybit API credentials are not configured (BYBIT_API_KEY / BYBIT_SECRET)");
    }

    const res = await this.signedPost<OrderCreateResult>("/v5/order/create", {
      category: "spot",
      symbol: params.symbol,
      side: params.side,
      orderType: "Market",
      qty: params.qty,
    });

    return { orderId: res.result.orderId, orderLinkId: res.result.orderLinkId };
  }

  private async publicGet<T>(path: string, query: Record<string, string>): Promise<BybitResponse<T>> {
    const qs = new URLSearchParams(query).toString();
    const res = await fetch(`${this.baseUrl}${path}?${qs}`);
    const json = (await res.json()) as BybitResponse<T>;

    if (json.retCode !== 0) {
      throw new Error(`Bybit API error ${json.retCode} on ${path}: ${json.retMsg}`);
    }
    return json;
  }

  private async signedPost<T>(path: string, body: Record<string, unknown>): Promise<BybitResponse<T>> {
    const timestamp = Date.now().toString();
    const payload = JSON.stringify(body);
    const signature = createHmac("sha256", this.apiSecret)
      .update(timestamp + this.apiKey + RECV_WINDOW + payload)
      .digest("hex");

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BAPI-API-KEY": this.apiKey,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": RECV_WINDOW,
        "X-BAPI-SIGN": signature,
      },
      body: payload,
    });
    const json = (await res.json()) as BybitResponse<T>;

    if (json.retCode !== 0) {
      throw new Error(`Bybit API error ${json.retCode} on ${path}: ${json.retMsg}`);
    }
    return json;
  }
}

export const bybit = new BybitClient();
