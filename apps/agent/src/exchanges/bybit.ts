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
  }

  /** Historical candles, oldest first, for a spot symbol. `interval` is in minutes ("1","5","15","60",...) or "D"/"W"/"M". */
  async getKlines(symbol: string, interval: string, limit = 100): Promise<Kline[]> {
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
