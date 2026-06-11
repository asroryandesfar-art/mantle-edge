# MantleEdge

**An autonomous, multi-agent AI trading system that thinks, decides, and proves it on-chain — built for Mantle.**

[![Live Dashboard](https://img.shields.io/badge/dashboard-live-00ff88)](https://dashboard-pi-flax-19.vercel.app)
[![Network](https://img.shields.io/badge/network-Mantle%20Sepolia%20Testnet-65b3ff)](https://explorer.sepolia.mantle.xyz)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#license)

| | |
|---|---|
| **Live Dashboard** | https://dashboard-pi-flax-19.vercel.app |
| **API** | https://api-production-57d8.up.railway.app |
| **Agent health** | https://agent-production-b53f.up.railway.app/health |
| **GitHub** | https://github.com/asroryandesfar-art/mantle-edge |
| **Network** | Mantle Sepolia Testnet (chainId `5003`) |
| **Explorer** | https://explorer.sepolia.mantle.xyz |
| **Agent wallet** | [`0x844771526F13d7a16d3135F7486545D61e81913C`](https://explorer.sepolia.mantle.xyz/address/0x844771526F13d7a16d3135F7486545D61e81913C) |

---

## 1. Problem

DeFi traders on emerging L2s like Mantle face three compounding problems:

1. **Information overload, no time** — profitable signals (RSI/EMA crossovers, volume anomalies) appear and decay in minutes, faster than a human can research, decide, and execute.
2. **Black-box bots** — most "trading bots" run off-chain with zero accountability. There's no way to verify *what* a bot decided, *why*, or whether it actually executed what it claims.
3. **No verifiable agent identity** — as autonomous agents start managing real value, there's currently no standard way to give an AI agent a persistent, on-chain identity with a track record that anyone can audit.

## 2. Solution

**MantleEdge** is an autonomous multi-agent trading system that:

- Continuously analyzes BTC/USDT, ETH/USDT and MNT/USDT using technical indicators (RSI, EMA20/50, volume z-score) plus LLM-based reasoning.
- Runs every decision through a dedicated risk-management agent (position sizing, stop-loss, daily loss limits) before anything is executed.
- Executes trades — routing swaps through Mantle DEXes (Merchant Moe / Agni Finance) when possible, and falling back to a transparent paper-trading ledger otherwise.
- **Logs every decision and execution as an on-chain event** via a `LogRegistry` / `TradeLogger` smart contract on Mantle, so anyone can audit the agent's behavior on the block explorer.
- Has its own **on-chain identity** (`AgentIdentityNFT`, ERC-8004-inspired ERC-721) recording its wallet, birth block, and cumulative trading stats.
- Streams everything — decisions, trades, PnL, gas price, identity — to a **live, public dashboard**.

## 3. Why This Project Matters

- **Trust through transparency.** Autonomous agents that move money need to be auditable. MantleEdge writes its reasoning and outcomes to Mantle so trust doesn't depend on taking a black box's word for it.
- **A reusable pattern for on-chain agents.** The `AgentIdentityRegistry` + `LogRegistry` + `TradeLogger` contracts form a minimal, ERC-8004-inspired template any autonomous agent on Mantle could adopt to get an identity and audit trail "for free."
- **Real infrastructure, not a slide deck.** Every piece — 4 contracts, an API, an agent worker, and a dashboard — is deployed and running continuously on Mantle Sepolia, Railway, and Vercel. This is what an autonomous on-chain agent looks like in production, not just in a demo script.
- **Mantle as the home for autonomous finance.** Low gas costs make it economically viable to log *every single decision* on-chain — something that would be cost-prohibitive on Ethereum mainnet. MantleEdge is a concrete example of the kind of high-frequency, agent-driven activity Mantle's low fees unlock.

---

## 4. Architecture

```
┌──────────────────┐   POST /api/decisions                     ┌───────────────────┐    GET /api/feed     ┌────────────────────┐
│   apps/agent      │   POST /api/trades                        │     apps/api       │   (polled every 10s) │  apps/dashboard     │
│   (Railway)       │ ─────────────────────────────────────────▶│   (Railway)        │ ────────────────────▶│  (Vercel)           │
│                   │   POST /api/agent/heartbeat               │   Express +        │                       │  Next.js 14 +       │
│  Multi-agent      │                                            │   SQLite           │                       │  Tailwind + shadcn  │
│  orchestrator     │                                            │                    │                       │                     │
│  (5 min cycle)    │                                            │  writes            │                       │  /            ← live│
└─────────┬─────────┘                                            │  agent-feed.json   │                       │  /history    ← logs │
          │                                                      │  (fallback file)   │                       │  /identity   ← NFT  │
          │ ethers v6 (signed txs, read RPC)                     └────────────────────┘                       └────────────────────┘
          ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         Mantle Sepolia Testnet (chainId 5003)                          │
│                                                                                          │
│   AgentIdentityRegistry   AgentIdentityNFT   TradeLogger   LogRegistry                  │
│   (multi-agent identity)  (this agent's ID)  (decision/exec │   (live action audit log) │
│                                               events)        │                            │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Monorepo layout** (pnpm workspace):

| Package | Role |
|---|---|
| `apps/agent` | The autonomous trading worker — multi-agent orchestrator, exchange/DEX adapters, on-chain clients. Deployed on Railway as a long-running service. |
| `apps/api` | Express + better-sqlite3 backend. Receives reports from the agent, serves `GET /api/feed` to the dashboard, and reads live gas price / agent identity directly from Mantle Sepolia via `ethers`. |
| `apps/dashboard` | Next.js 14 + Tailwind + shadcn/ui. Public, real-time terminal-style UI. Polls `apps/api` every 10s via SWR. |
| `packages/contracts` | Solidity contracts (Hardhat) deployed to Mantle Sepolia. |
| `packages/shared` | Shared types, technical-indicator math (RSI/EMA), and Mantle network/token constants. |

---

## 5. Agent Workflow (Multi-Agent Pipeline)

Every `ORCHESTRATOR_CYCLE_MS` (default **5 minutes**), `runCycle()` runs four specialized agents in sequence for each watched asset (`apps/agent/src/multiagent/orchestrator.ts`):

```
 MarketAnalystAgent  ──▶  RiskManagerAgent  ──▶  ExecutorAgent  ──▶  ReporterAgent
```

1. **MarketAnalystAgent** (`marketAnalyst.ts`) — pulls 15-minute klines from Bybit (CoinGecko as fallback) for BTC/USDT, ETH/USDT, MNT/USDT, computes RSI(14), EMA20, EMA50 and a volume-anomaly z-score, derives a rule-based LONG/SHORT/WAIT signal, then asks an LLM (Claude/GPT, with the rule-based result as a deterministic fallback if no API key is configured) to confirm or refine the call with natural-language reasoning.

2. **RiskManagerAgent** (`riskManager.ts`) — a pure 7-step decision tree that turns a signal into an approved/rejected action: stop-loss breach → close, signal reversal → close, already-positioned → no-op, low confidence (`< MIN_CONFIDENCE`) → no-op, daily loss limit breached → block new entries, otherwise size the position as `min(equity × RISK_MAX_POSITION_PCT, cash)` with a computed stop-loss.

3. **ExecutorAgent** (`executorAgent.ts`) — updates the paper-trading ledger, then:
   - **Attempts a real on-chain DEX swap** (Merchant Moe / Agni Finance, best-quote routing) via `attemptOnChainSwap()`. This call **never throws** — if the swap can't be routed (e.g. the configured token addresses don't have liquidity on this network), execution gracefully falls back to the paper-trading result.
   - **Always emits an on-chain audit event** via `LogRegistry.logAction(action, asset, amount, price, note)` — this is the agent's permanent, verifiable record of "I decided X and acted on it."

4. **ReporterAgent** (`reporter.ts`) — POSTs the decision and execution result to `apps/api` (which persists them and refreshes the dashboard feed), and runs an independent heartbeat loop (every `REPORTER_INTERVAL_MS`, default 1 min) so the dashboard always knows the agent is alive.

The agent runs **every cycle, every asset, forever** — fully autonomously, with no human in the loop.

---

## 6. Mantle Integration

MantleEdge is built *on* Mantle, not just deployed *to* it:

- **Network**: Mantle Sepolia Testnet, chainId `5003`, RPC `https://rpc.sepolia.mantle.xyz`.
- **Live gas price**: `apps/api` reads `provider.getFeeData()` from the Mantle Sepolia RPC every 60s and surfaces it on every dashboard page (top bar: `Gas: XX.XXX Gwei`).
- **On-chain agent identity**: the dashboard's `/identity` page reads `AgentIdentityNFT.ownerOf(1)` and `deployedAt()` directly from chain via `ethers` — the "Owner Wallet", "Birth Block" and "Network" fields are live on-chain reads, not hardcoded.
- **On-chain audit trail**: every executor cycle calls `LogRegistry.logAction(...)` on Mantle Sepolia, emitting an `ActionLogged` event with the action, asset, amount, price and reasoning note — a permanent, queryable record of the agent's behavior.
- **DEX execution on Mantle**: `apps/agent/src/dex/` implements adapters for **Merchant Moe** (Liquidity Book v2.2) and **Agni Finance** (concentrated-liquidity AMM), both native Mantle DEXes, with best-quote routing across the two.
- **Identity registry**: `AgentIdentityRegistry` is an ERC-8004-inspired ERC-721 registry that lets any number of agents register an on-chain identity (`agentAddress` ↔ `agentId` ↔ `agentURI`), establishing a reusable identity standard for autonomous agents on Mantle.

Every contract address below is deployed and verifiable on Mantle Sepolia right now — see the **"Smart Contracts on Mantle"** card on the live dashboard for one-click explorer links.

---

## 7. Smart Contracts (Mantle Sepolia, chainId 5003)

| Contract | Address | Purpose |
|---|---|---|
| [`AgentIdentityRegistry`](https://explorer.sepolia.mantle.xyz/address/0x6EA3EA91896CBA417570F58B25f44ec4BE004ea1) | `0x6EA3EA91896CBA417570F58B25f44ec4BE004ea1` | ERC-8004-inspired multi-agent ERC-721 identity registry (`register`, `setAgentURI`, `setAgentAddress`). |
| [`AgentIdentityNFT`](https://explorer.sepolia.mantle.xyz/address/0xE355E725c60eea454a9ba47dD57e65A5650cb119) | `0xE355E725c60eea454a9ba47dD57e65A5650cb119` | This agent's single ERC-721 identity (`MEA #1`), with `updateStats(pnl, tradeCount)`. |
| [`TradeLogger`](https://explorer.sepolia.mantle.xyz/address/0x1Ef136f9dd6eA3A9f13Fb840854Ee3F5a2976628) | `0x1Ef136f9dd6eA3A9f13Fb840854Ee3F5a2976628` | `Ownable` event log: `DecisionLogged` / `ExecutionLogged`. |
| [`LogRegistry`](https://explorer.sepolia.mantle.xyz/address/0xeB4848E15DaE5881300479f9BF057DbAf86F4D4b) | `0xeB4848E15DaE5881300479f9BF057DbAf86F4D4b` | Permissionless `ActionLogged` event log — the agent's live, on-chain audit trail (active in production). |

All four were deployed in a single batch from `packages/contracts/scripts/deployAll.ts`; see `packages/contracts/deployments/mantleSepolia.json` for the canonical addresses and deployer.

Contracts are written in Solidity `^0.8.24` using OpenZeppelin's `ERC721` and `Ownable`.

---

## 8. The Dashboard

The live dashboard (https://dashboard-pi-flax-19.vercel.app) polls `apps/api`'s `/api/feed` every 10 seconds and shows:

- **Network** — "Mantle Sepolia Testnet" shown in the sidebar, derived from `NEXT_PUBLIC_MANTLE_CHAIN_ID` (also used to drive the wallet's "switch network" prompt).
- **Live agent status** — a pulsing "Agent is Live" indicator, uptime, and status sourced from the agent's heartbeat loop (`RUNNING` / `IDLE`).
- **On-chain activity** — live gas price (read from the Mantle Sepolia RPC) and the agent's wallet address in the terminal header on every page, plus a dedicated **"Smart Contracts on Mantle"** panel linking to all four deployed contracts on the explorer.
- **Trading decisions** — a real-time feed of every `MarketAnalystAgent` decision (asset, direction, confidence, reasoning) on the home page.
- **Performance metrics** — Total PnL, win rate, on-chain execution count, active position, and an agent-vs-human PnL comparison chart.
- **Trade history** (`/history`) — full execution log with entry/exit price, size, confidence, PnL, and a direct explorer link for any trade with a real on-chain tx hash (paper-trading entries are clearly labeled `PAPER TRADE`).
- **Agent identity** (`/identity`) — the agent's ERC-8004-style on-chain profile: token ID, owner wallet, birth block, network, lifetime trades and PnL, all backed by live `AgentIdentityNFT` reads.

---

## 9. Screenshots

> The fastest way to see MantleEdge is the **live dashboard** — https://dashboard-pi-flax-19.vercel.app — it updates every 10 seconds with real agent activity.

For static screenshots (e.g. for a submission form), capture:

| Page | What to capture |
|---|---|
| `/` (Dashboard) | Hero "Agent is Live" status, metrics grid, decision feed, "Smart Contracts on Mantle" panel |
| `/history` | Trade history table with explorer links |
| `/identity` | Agent identity card + on-chain verification panel |
| Block explorer | `LogRegistry` contract page showing `ActionLogged` events from the agent's wallet |

Save captures under `docs/screenshots/` and reference them here, e.g. `![Dashboard](docs/screenshots/dashboard.png)`.

---

## 10. Demo Instructions

See [`DEMO.md`](./DEMO.md) for the full walkthrough. Quick version:

1. Open the [live dashboard](https://dashboard-pi-flax-19.vercel.app) — no setup required, it's already running 24/7 against the deployed agent.
2. Watch the **decision feed** update every cycle (every 5 minutes) with real reasoning for BTC/USDT, ETH/USDT, MNT/USDT.
3. Click any contract in **"Smart Contracts on Mantle"** to view it on the Mantle Sepolia explorer, including live `ActionLogged` events emitted by the agent's wallet `0x8447...913C`.
4. Visit `/identity` to see the agent's on-chain ERC-721 profile (owner, birth block, network — all live RPC reads).
5. Visit `/history` for the full trade log.

To run everything locally instead:

```bash
pnpm install
cp .env.example .env   # fill in RPC URL, agent wallet key, etc.
pnpm build:shared
pnpm --filter @mantle-edge/api dev        # terminal 1
pnpm --filter @mantle-edge/agent dev      # terminal 2 (or: start:multiagent)
pnpm --filter @mantle-edge/dashboard dev  # terminal 3
```

---

## 11. Judging Highlights

- ✅ **Autonomous agent** — runs continuously on a 5-minute cycle with zero human input, from market analysis through execution and reporting.
- ✅ **On-chain execution** — every decision/execution is logged on Mantle Sepolia via `LogRegistry.logAction`, and the executor attempts real DEX swaps via Merchant Moe / Agni Finance.
- ✅ **Multi-agent architecture** — four specialized agents (Analyst, Risk Manager, Executor, Reporter) with clear, single-responsibility boundaries and a pure, testable risk-decision function.
- ✅ **Real dashboard** — live, polling, terminal-style UI with on-chain reads (gas price, agent identity), not a static mock.
- ✅ **Production deployment** — 4 contracts on Mantle Sepolia, `apps/api` + `apps/agent` on Railway, `apps/dashboard` on Vercel, all wired together and running right now.

---

## 12. Known Limitations (Honest Notes)

We'd rather be upfront about these than have a judge discover them:

- **DEX swaps on testnet**: `attemptOnChainSwap()` routes through `TOKENS_BY_SYMBOL`, which currently points at **Mantle mainnet** token addresses (Merchant Moe / Agni pools don't exist on Sepolia for these pairs). On testnet, swaps gracefully fail and the agent falls back to its paper-trading ledger — but the **on-chain decision/execution audit log via `LogRegistry` is real and active** on every cycle. On mainnet (once the agent wallet is funded with real MNT), the same code path executes live swaps.
- **Ephemeral API storage**: `apps/api`'s SQLite database has no persistent Railway volume yet, so trade/decision history resets on redeploy. A Railway volume mount is the planned fix (see Roadmap).
- **Market data rate limits**: the primary feed (Bybit) falls back to CoinGecko's free tier, which rate-limits aggressively under sustained polling — this can occasionally produce a `WAIT` / 0%-confidence cycle for an asset until the next refresh.
- **Paper-trading PnL**: performance metrics reflect a $1,000 simulated portfolio sized by the risk manager, not real capital — this mirrors the testnet DEX limitation above.

---

## 13. Future Roadmap

- **Mainnet deployment** — redeploy all four contracts to Mantle mainnet (chainId 5000) and fund the agent wallet for real DEX execution via Merchant Moe / Agni Finance.
- **Persistent storage** — add a Railway volume (or migrate to Postgres) so trade/decision history survives redeploys.
- **Wallet-synced portfolio** — let connected users compare *their* on-chain portfolio's PnL against the agent's, using the "Connect Wallet" flow already wired into the dashboard.
- **More assets & strategies** — expand beyond BTC/ETH/MNT and add pluggable strategy modules competing for capital allocation.
- **Agent-to-agent coordination (A2A)** — use `AgentIdentityRegistry` as the basis for multiple specialized agents (e.g. per-asset analysts) to register independent identities and be orchestrated together.
- **On-chain reputation** — extend `AgentIdentityNFT.updateStats` into a broader reputation score that other contracts/agents can read and act on.

---

## 14. Tech Stack

- **Contracts**: Solidity `^0.8.24`, OpenZeppelin (`ERC721`, `Ownable`), Hardhat
- **Agent**: Node.js (TypeScript), `ethers` v6, Bybit + CoinGecko market data, Anthropic/OpenAI LLM reasoning with rule-based fallback, Zod
- **API**: Express, `better-sqlite3`, `ethers` v6
- **Dashboard**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Recharts, SWR
- **Infra**: Railway (api + agent, Docker), Vercel (dashboard), pnpm workspaces

## License

MIT — see [`package.json`](./package.json).
