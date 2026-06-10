import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { config } from "../config.js";
import { createLogger } from "../logger.js";
import { SignalDirectionSchema, type MarketIndicators, type SignalDirection } from "./types.js";

const logger = createLogger("multiagent:llm");

export interface MarketReasoningInput {
  asset: string;
  price: number;
  indicators: MarketIndicators;
  /** Deterministic fallback direction, used if the LLM is unavailable or returns malformed output. */
  ruleDirection: SignalDirection;
  /** Deterministic fallback confidence (0-100), used alongside `ruleDirection`. */
  ruleConfidence: number;
}

export interface MarketReasoningOutput {
  direction: SignalDirection;
  confidence: number;
  reasoning: string;
}

const LlmResponseSchema = z.object({
  direction: SignalDirectionSchema,
  confidence: z.number().min(0).max(100),
  reasoning: z.string().min(1),
});

const client = config.llm.anthropicApiKey ? new Anthropic({ apiKey: config.llm.anthropicApiKey }) : null;

/** True if an Anthropic API key is configured and LLM-based reasoning is available. */
export const isLlmConfigured = client !== null;

/**
 * Asks Claude to interpret the indicator snapshot for `input.asset` and produce a
 * MarketSignal direction/confidence/reasoning. Falls back to a deterministic,
 * indicator-based explanation if the LLM is not configured or its response is
 * malformed/unavailable.
 */
export async function reasonAboutMarket(input: MarketReasoningInput): Promise<MarketReasoningOutput> {
  if (!client) {
    return ruleBasedReasoning(input);
  }

  try {
    const message = await client.messages.create({
      model: config.llm.anthropicModel,
      max_tokens: 256,
      system:
        "You are a crypto market analyst. Given price and technical indicators for a single asset, " +
        'respond with ONLY a JSON object of the form {"direction":"LONG"|"SHORT"|"WAIT","confidence":0-100,"reasoning":"..."}. ' +
        "No markdown, no code fences, no extra text. Keep reasoning to one or two sentences.",
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });

    const block = message.content[0];
    if (!block || block.type !== "text") {
      throw new Error("LLM response did not contain a text block");
    }

    const parsed = LlmResponseSchema.parse(JSON.parse(extractJson(block.text)));
    return parsed;
  } catch (err) {
    logger.warn("LLM reasoning failed, falling back to rule-based reasoning", {
      asset: input.asset,
      error: err instanceof Error ? err.message : String(err),
    });
    return ruleBasedReasoning(input);
  }
}

/** Strips markdown code fences, if present, so a JSON payload can be parsed directly. */
function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return fenced ? fenced[1]!.trim() : trimmed;
}

/** Deterministic indicator-based reasoning, used when the LLM is unavailable. */
function ruleBasedReasoning(input: MarketReasoningInput): MarketReasoningOutput {
  const { rsi14, ema20, ema50, volumeAnomaly } = input.indicators;
  const parts: string[] = [];

  if (rsi14 !== null) {
    if (rsi14 >= 70) parts.push(`RSI(14)=${rsi14.toFixed(1)} is overbought`);
    else if (rsi14 <= 30) parts.push(`RSI(14)=${rsi14.toFixed(1)} is oversold`);
    else parts.push(`RSI(14)=${rsi14.toFixed(1)} is neutral`);
  }

  if (ema20 !== null && ema50 !== null) {
    parts.push(ema20 > ema50 ? `EMA20 (${ema20.toFixed(4)}) is above EMA50 (${ema50.toFixed(4)}), an uptrend` : `EMA20 (${ema20.toFixed(4)}) is below EMA50 (${ema50.toFixed(4)}), a downtrend`);
  }

  if (volumeAnomaly !== null && Math.abs(volumeAnomaly) >= 2) {
    parts.push(`volume is ${volumeAnomaly > 0 ? "anomalously high" : "anomalously low"} (z=${volumeAnomaly.toFixed(2)})`);
  }

  const reasoning =
    parts.length > 0
      ? `Rule-based: ${parts.join("; ")}.`
      : `Rule-based: insufficient indicator history for ${input.asset}, defaulting to WAIT.`;

  return {
    direction: input.ruleDirection,
    confidence: input.ruleConfidence,
    reasoning,
  };
}
