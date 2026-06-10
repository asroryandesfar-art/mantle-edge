import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AgentDecisionSchema,
  TradeLogSchema,
  type AgentDecision,
  type TradeLog,
} from "@mantle-edge/shared";
import { config } from "../config.js";

const TRADES_FILE = path.join(config.dataDir, "trades.json");
const DECISIONS_FILE = path.join(config.dataDir, "decisions.json");

/** Number of records retained per log file before older entries are dropped. */
const MAX_RECORDS = 1000;

async function readJsonArray<T>(file: string): Promise<T[]> {
  try {
    const raw = await readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeJsonArray<T>(file: string, data: T[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2));
}

/** Appends a completed trade to `data/trades.json`, keeping only the most recent records. */
export async function appendTradeLog(trade: TradeLog): Promise<void> {
  TradeLogSchema.parse(trade);
  const trades = await readJsonArray<TradeLog>(TRADES_FILE);
  trades.push(trade);
  await writeJsonArray(TRADES_FILE, trades.slice(-MAX_RECORDS));
}

/** Appends a strategy decision to `data/decisions.json`, keeping only the most recent records. */
export async function appendDecisionLog(decision: AgentDecision): Promise<void> {
  AgentDecisionSchema.parse(decision);
  const decisions = await readJsonArray<AgentDecision>(DECISIONS_FILE);
  decisions.push(decision);
  await writeJsonArray(DECISIONS_FILE, decisions.slice(-MAX_RECORDS));
}

export async function getTradeLogs(): Promise<TradeLog[]> {
  return readJsonArray<TradeLog>(TRADES_FILE);
}

export async function getDecisionLogs(): Promise<AgentDecision[]> {
  return readJsonArray<AgentDecision>(DECISIONS_FILE);
}

export async function getLastDecision(): Promise<AgentDecision | null> {
  const decisions = await getDecisionLogs();
  return decisions.at(-1) ?? null;
}
