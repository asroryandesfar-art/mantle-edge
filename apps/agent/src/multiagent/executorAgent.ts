import { splitPair, TOKENS_BY_SYMBOL } from "@mantle-edge/shared";
import { Erc20 } from "../chain/erc20.js";
import { wallet } from "../chain/provider.js";
import { getAdapter, getBestQuote } from "../dex/index.js";
import { createLogger } from "../logger.js";
import type { TradingDb } from "./db.js";
import { logRegistry } from "./logRegistry.js";
import type { ExecutionResult, TradeDecision } from "./types.js";

const logger = createLogger("multiagent:executor");

/** Maximum acceptable slippage from a DEX quote, in basis points (0.5%). */
const DEX_SLIPPAGE_BPS = 50;

/**
 * Attempts a real on-chain swap on Mantle representing `decision`. Returns
 * null if `decision.asset` has no on-chain token mapping (e.g. BTC/USDT,
 * ETH/USDT), in which case the executor falls back to paper-trading only.
 * Never throws: swap failures are returned as `{ error }`.
 */
async function attemptOnChainSwap(
  decision: TradeDecision,
  positionDirection: "LONG" | "SHORT",
): Promise<{ txHash?: string; error?: string } | null> {
  const { base, quote } = splitPair(decision.asset);
  const baseToken = TOKENS_BY_SYMBOL[base];
  const quoteToken = TOKENS_BY_SYMBOL[quote];
  if (!baseToken || !quoteToken) return null;

  // OPEN_LONG (or closing a SHORT) buys the base asset with the quote asset.
  // OPEN_SHORT (or closing a LONG) sells the base asset for the quote asset.
  const buyingBase = decision.action === "OPEN_LONG" || (decision.action === "CLOSE" && positionDirection === "SHORT");
  const tokenIn = buyingBase ? quoteToken : baseToken;
  const tokenOut = buyingBase ? baseToken : quoteToken;

  // `decision.size` is a USD notional; convert to tokenIn units using the latest price.
  const amountInFloat = buyingBase ? decision.size : decision.size / decision.signal.price;
  const amountIn = Erc20.parseUnits(amountInFloat.toFixed(tokenIn.decimals), tokenIn.decimals);

  try {
    const balance = await new Erc20(tokenIn.address, wallet).balanceOf(wallet.address);
    if (balance < amountIn) {
      throw new Error(
        `Insufficient ${tokenIn.symbol} balance: have ${Erc20.formatUnits(balance, tokenIn.decimals)}, need ${amountInFloat}`,
      );
    }

    const dexQuote = await getBestQuote(tokenIn, tokenOut, amountIn);
    if (!dexQuote) {
      throw new Error(`No on-chain route found for ${tokenIn.symbol} -> ${tokenOut.symbol}`);
    }

    const adapter = getAdapter(dexQuote.dex);
    const swap = await adapter.swap(dexQuote, { slippageBps: DEX_SLIPPAGE_BPS, recipient: wallet.address });

    logger.info("on-chain swap executed", {
      asset: decision.asset,
      action: decision.action,
      dex: dexQuote.dex,
      txHash: swap.txHash,
    });

    return { txHash: swap.txHash };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("on-chain swap failed or unavailable, continuing with paper trade only", {
      asset: decision.asset,
      action: decision.action,
      error: message,
    });
    return { error: message };
  }
}

/**
 * Executes an approved TradeDecision: updates the paper-trading portfolio in
 * SQLite, attempts a real on-chain swap (when the asset has a token mapping),
 * and records the action via LogRegistry. Never throws.
 */
export async function runExecutor(decision: TradeDecision, db: TradingDb): Promise<ExecutionResult> {
  const timestamp = Date.now();
  const price = decision.signal.price;

  if (!decision.approved || decision.action === "NONE") {
    return { status: "none", asset: decision.asset, action: "NONE", price, size: 0, timestamp };
  }

  let positionDirection: "LONG" | "SHORT";
  let pnl: number | undefined;
  let entryPrice: number | undefined;
  const confidence = decision.signal.confidence;

  try {
    if (decision.action === "OPEN_LONG" || decision.action === "OPEN_SHORT") {
      positionDirection = decision.action === "OPEN_LONG" ? "LONG" : "SHORT";
      db.openPosition({
        asset: decision.asset,
        direction: positionDirection,
        entryPrice: price,
        size: decision.size,
        stopLoss: decision.stopLoss,
        openedAt: timestamp,
      });
    } else {
      const existing = db.getOpenPosition(decision.asset);
      if (!existing) {
        const result: ExecutionResult = {
          status: "skipped",
          asset: decision.asset,
          action: decision.action,
          price,
          size: decision.size,
          confidence,
          error: "No open position to close",
          timestamp,
        };
        db.recordTrade(result);
        return result;
      }
      positionDirection = existing.direction;
      ({ pnl, entryPrice } = db.closePosition(decision.asset, price));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("paper-trading ledger update failed", { asset: decision.asset, action: decision.action, error: message });
    const result: ExecutionResult = {
      status: "failed",
      asset: decision.asset,
      action: decision.action,
      price,
      size: decision.size,
      confidence,
      error: message,
      timestamp,
    };
    db.recordTrade(result);
    return result;
  }

  const swap = await attemptOnChainSwap(decision, positionDirection);
  const logTxHash = (await logRegistry.logAction(decision.action, decision.asset, decision.size, price, decision.reason)) ?? undefined;

  const result: ExecutionResult = {
    status: swap === null ? "skipped" : swap.error ? "failed" : "success",
    asset: decision.asset,
    action: decision.action,
    price,
    size: decision.size,
    pnl,
    entryPrice,
    confidence,
    txHash: swap?.txHash,
    logTxHash,
    error: swap?.error,
    timestamp,
  };

  db.recordTrade(result);

  logger.info("execution complete", {
    asset: decision.asset,
    action: decision.action,
    status: result.status,
    pnl,
    txHash: result.txHash,
    logTxHash: result.logTxHash,
  });

  return result;
}
