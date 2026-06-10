import { randomUUID } from "node:crypto";
import {
  TOKENS_BY_SYMBOL,
  splitPair,
  type AgentDecision,
  type DexName,
  type TradeLog,
} from "@mantle-edge/shared";
import { config } from "../config.js";
import { createLogger } from "../logger.js";
import { wallet } from "../chain/provider.js";
import { Erc20 } from "../chain/erc20.js";
import { getAdapter, getBestQuote } from "../dex/index.js";
import { bybit } from "../exchanges/bybit.js";

const logger = createLogger("executor");

/** Maximum acceptable slippage from a DEX quote, in basis points (0.5%). */
const DEX_SLIPPAGE_BPS = 50;

/** An {@link AgentDecision} that has been confirmed to be actionable (not HOLD). */
type TradableDecision = Omit<AgentDecision, "action"> & { action: "BUY" | "SELL" };

/**
 * Executes a strategy decision, if it clears the configured confidence
 * threshold. Returns the resulting trade log entry, or null if no trade
 * was attempted (HOLD or low-confidence decision).
 */
export async function executeDecision(decision: AgentDecision): Promise<TradeLog | null> {
  if (decision.action === "HOLD") {
    logger.debug("decision is HOLD, nothing to execute");
    return null;
  }

  if (decision.confidence < config.trading.minConfidence) {
    logger.info("confidence below threshold, skipping trade", {
      confidence: decision.confidence,
      minConfidence: config.trading.minConfidence,
    });
    return null;
  }

  const tradable = decision as TradableDecision;
  return tradable.venue === "dex" ? executeDexTrade(tradable) : executeCexTrade(tradable);
}

async function executeDexTrade(decision: TradableDecision): Promise<TradeLog> {
  const { base, quote } = splitPair(decision.pair);
  const baseToken = TOKENS_BY_SYMBOL[base];
  const quoteToken = TOKENS_BY_SYMBOL[quote];
  if (!baseToken || !quoteToken) {
    throw new Error(`No on-chain token mapping for pair ${decision.pair}`);
  }

  const isBuy = decision.action === "BUY";
  const tokenIn = isBuy ? quoteToken : baseToken;
  const tokenOut = isBuy ? baseToken : quoteToken;
  const amountInFloat = isBuy ? decision.amount * decision.price : decision.amount;
  const amountIn = Erc20.parseUnits(amountInFloat.toFixed(tokenIn.decimals), tokenIn.decimals);

  const id = randomUUID();
  const timestamp = Date.now();

  try {
    const balance = await new Erc20(tokenIn.address, wallet).balanceOf(wallet.address);
    if (balance < amountIn) {
      throw new Error(
        `Insufficient ${tokenIn.symbol} balance: have ${Erc20.formatUnits(balance, tokenIn.decimals)}, ` +
          `need ${amountInFloat}`,
      );
    }

    const dexQuote = await getBestQuote(tokenIn, tokenOut, amountIn);
    if (!dexQuote) {
      throw new Error(`No on-chain route found for ${tokenIn.symbol} -> ${tokenOut.symbol}`);
    }

    const adapter = getAdapter(dexQuote.dex);
    const swap = await adapter.swap(dexQuote, { slippageBps: DEX_SLIPPAGE_BPS, recipient: wallet.address });
    const amountOutFloat = Number(Erc20.formatUnits(swap.amountOut, tokenOut.decimals));
    const price = isBuy ? amountInFloat / amountOutFloat : amountOutFloat / amountInFloat;

    logger.info("dex trade executed", {
      pair: decision.pair,
      action: decision.action,
      dex: dexQuote.dex,
      txHash: swap.txHash,
      amountIn: amountInFloat,
      amountOut: amountOutFloat,
    });

    return {
      id,
      timestamp,
      pair: decision.pair,
      action: decision.action,
      venue: "dex",
      dex: dexQuote.dex as DexName,
      tokenIn: tokenIn.symbol,
      tokenOut: tokenOut.symbol,
      amountIn: amountInFloat,
      amountOut: amountOutFloat,
      price,
      status: "success",
      txHash: swap.txHash,
      decision,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("dex trade failed", { pair: decision.pair, action: decision.action, error: message });

    return {
      id,
      timestamp,
      pair: decision.pair,
      action: decision.action,
      venue: "dex",
      tokenIn: tokenIn.symbol,
      tokenOut: tokenOut.symbol,
      amountIn: amountInFloat,
      amountOut: 0,
      price: decision.price,
      status: "failed",
      error: message,
      decision,
    };
  }
}

async function executeCexTrade(decision: TradableDecision): Promise<TradeLog> {
  const { base, quote } = splitPair(decision.pair);
  const isBuy = decision.action === "BUY";

  const id = randomUUID();
  const timestamp = Date.now();
  const tokenIn = isBuy ? quote : base;
  const tokenOut = isBuy ? base : quote;
  const rawQty = isBuy ? decision.amount * decision.price : decision.amount;

  try {
    const info = await bybit.getInstrumentInfo(config.bybit.symbol);
    const precision = isBuy ? info.quotePrecision : info.basePrecision;
    const qty = Number(rawQty.toFixed(precision));
    const minQty = isBuy ? info.minOrderAmt : info.minOrderQty;

    if (qty < minQty) {
      throw new Error(`Order quantity ${qty} ${tokenIn} is below Bybit minimum ${minQty} ${tokenIn}`);
    }

    const order = await bybit.placeMarketOrder({
      symbol: config.bybit.symbol,
      side: isBuy ? "Buy" : "Sell",
      qty: qty.toString(),
    });

    logger.info("cex order submitted", {
      pair: decision.pair,
      action: decision.action,
      symbol: config.bybit.symbol,
      orderId: order.orderId,
      qty,
    });

    return {
      id,
      timestamp,
      pair: decision.pair,
      action: decision.action,
      venue: "cex",
      tokenIn,
      tokenOut,
      amountIn: qty,
      amountOut: isBuy ? qty / decision.price : qty * decision.price,
      price: decision.price,
      status: "submitted",
      orderId: order.orderId,
      decision,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("cex trade failed", { pair: decision.pair, action: decision.action, error: message });

    return {
      id,
      timestamp,
      pair: decision.pair,
      action: decision.action,
      venue: "cex",
      tokenIn,
      tokenOut,
      amountIn: rawQty,
      amountOut: 0,
      price: decision.price,
      status: "failed",
      error: message,
      decision,
    };
  }
}
