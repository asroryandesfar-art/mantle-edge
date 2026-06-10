import { z } from "zod";
import { DEX_NAMES, EXECUTION_VENUES, TRADE_ACTIONS } from "./constants.js";

/** Lower-cased or checksummed 20-byte hex address. */
export const EthereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Expected a 0x-prefixed 20-byte hex address");

/** 32-byte transaction / message hash. */
export const TxHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Expected a 0x-prefixed 32-byte hex hash");

export const TradeActionSchema = z.enum(TRADE_ACTIONS);
export type TradeAction = z.infer<typeof TradeActionSchema>;

export const ExecutionVenueSchema = z.enum(EXECUTION_VENUES);
export type ExecutionVenue = z.infer<typeof ExecutionVenueSchema>;

export const DexNameSchema = z.enum(DEX_NAMES);
export type DexName = z.infer<typeof DexNameSchema>;

/**
 * A single decision produced by the agent's strategy engine for a given
 * trading pair, before any execution has taken place.
 */
export const AgentDecisionSchema = z.object({
  /** Unix epoch milliseconds when the decision was produced. */
  timestamp: z.number().int().positive(),
  /** Trading pair in BASE/QUOTE form, e.g. "MNT/USDT". */
  pair: z.string().min(3),
  /** What the agent has decided to do. */
  action: TradeActionSchema,
  /** Where the action would be executed. */
  venue: ExecutionVenueSchema,
  /** Confidence in the decision, from 0 (none) to 1 (certain). */
  confidence: z.number().min(0).max(1),
  /** Reference price (quote per base) the decision was based on. */
  price: z.number().positive(),
  /** Quantity of the base asset to trade. 0 for HOLD decisions. */
  amount: z.number().nonnegative(),
  /** Human-readable explanation of why this decision was made. */
  reasoning: z.string().min(1),
  /** Named indicator values that fed into the decision (e.g. SMA, RSI). */
  indicators: z.record(z.string(), z.number()).default({}),
});
export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

/** Status of a trade after the executor has attempted it. */
export const TradeStatusSchema = z.enum(["pending", "submitted", "success", "failed"]);
export type TradeStatus = z.infer<typeof TradeStatusSchema>;

/**
 * A record of a trade the agent attempted to execute, including the
 * decision that triggered it and the on-chain / exchange result.
 */
export const TradeLogSchema = z.object({
  /** Unique identifier for this trade record (UUID v4). */
  id: z.string().uuid(),
  /** Unix epoch milliseconds when the trade was executed. */
  timestamp: z.number().int().positive(),
  /** Trading pair in BASE/QUOTE form, e.g. "MNT/USDT". */
  pair: z.string().min(3),
  /** BUY or SELL (HOLD trades are never logged). */
  action: z.enum(["BUY", "SELL"]),
  /** Where the trade was executed. */
  venue: ExecutionVenueSchema,
  /** Which DEX was used, if venue === "dex". */
  dex: DexNameSchema.optional(),
  /** Symbol of the token sold. */
  tokenIn: z.string(),
  /** Symbol of the token bought. */
  tokenOut: z.string(),
  /** Human-readable amount of tokenIn that was sold. */
  amountIn: z.number().nonnegative(),
  /** Human-readable amount of tokenOut that was received (or expected). */
  amountOut: z.number().nonnegative(),
  /** Effective execution price (quote per base). */
  price: z.number().positive(),
  /** Current lifecycle status of the trade. */
  status: TradeStatusSchema,
  /** On-chain transaction hash, present once submitted to Mantle. */
  txHash: TxHashSchema.optional(),
  /** Bybit order ID, present once submitted to the exchange. */
  orderId: z.string().optional(),
  /** Error message if status === "failed". */
  error: z.string().optional(),
  /** The decision that triggered this trade. */
  decision: AgentDecisionSchema,
});
export type TradeLog = z.infer<typeof TradeLogSchema>;

/**
 * On-chain identity of the agent, registered against an
 * ERC-8004-style AgentIdentityRegistry contract.
 * @see https://eips.ethereum.org/EIPS/eip-8004
 */
export const AgentIdentitySchema = z.object({
  /** Token ID assigned by the identity registry, as a base-10 string. */
  agentId: z.string().regex(/^\d+$/, "Expected a base-10 integer string"),
  /** Address of the AgentIdentityRegistry contract. */
  registry: EthereumAddressSchema,
  /** Chain ID the registry is deployed on. */
  chainId: z.number().int().positive(),
  /** Owner of the identity NFT (controls the registry record). */
  owner: EthereumAddressSchema,
  /** Operating wallet address the agent signs transactions with. */
  agentAddress: EthereumAddressSchema,
  /** Off-chain metadata URI (IPFS/HTTPS) describing the agent. */
  metadataURI: z.string().url().or(z.string().startsWith("ipfs://")),
  /** Unix epoch milliseconds when the identity was registered. */
  registeredAt: z.number().int().positive(),
});
export type AgentIdentity = z.infer<typeof AgentIdentitySchema>;

/** Aggregate snapshot returned by the agent's status endpoint. */
export const AgentStatusSchema = z.object({
  /** Operating wallet address. */
  address: EthereumAddressSchema,
  /** Chain ID the agent is connected to. */
  chainId: z.number().int().positive(),
  /** Native MNT balance, formatted as a decimal string. */
  nativeBalance: z.string(),
  /** Token balances keyed by symbol, formatted as decimal strings. */
  tokenBalances: z.record(z.string(), z.string()),
  /** Trading pair the agent is currently watching. */
  pair: z.string(),
  /** Most recent decision produced by the strategy engine, if any. */
  lastDecision: AgentDecisionSchema.nullable(),
  /** On-chain identity, if registered. */
  identity: AgentIdentitySchema.nullable(),
  /** Unix epoch milliseconds when this status was generated. */
  updatedAt: z.number().int().positive(),
});
export type AgentStatus = z.infer<typeof AgentStatusSchema>;
