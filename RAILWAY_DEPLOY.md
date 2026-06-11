# Deploying MantleEdge: Railway (api + agent) + Vercel (dashboard)

**Status: LIVE** ✅

| Service | URL |
|---|---|
| Dashboard (Vercel) | https://dashboard-pi-flax-19.vercel.app |
| API (Railway) | https://api-production-57d8.up.railway.app |
| Agent health (Railway) | https://agent-production-b53f.up.railway.app/health |
| Railway project | `mantle-edge` (`020e2aaa-87ea-4c11-bbfd-e05b2be6058d`), services `api` + `agent` |

Architecture:

```
Agent → POST decisions/trades/heartbeat → API (Express, Railway) → SQLite
                                              ↓
                                   writes agent-feed.json (fallback only)
                                              ↓
                              Dashboard (Vercel) ← GET /api/feed (polling 10s)
```

`apps/api` and `apps/agent` are deployed as two separate Railway services from
this same repo, each using its own Dockerfile. Both Dockerfiles use
`node:22-alpine` (required by `packageManager: pnpm@11.5.3` in the root
`package.json`, which needs Node ≥22.13). The Dockerfile path per service is
set via the `RAILWAY_DOCKERFILE_PATH` build variable (`apps/api/Dockerfile` /
`apps/agent/Dockerfile`), so `railway up` can be run from the repo root with
the full pnpm workspace as build context. `apps/dashboard` stays on Vercel.

---

## Step 1 — `apps/api` — DONE

- Service `api` created in the `mantle-edge` Railway project.
- Variables set: `RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile`, `PORT=3002`,
  `NODE_ENV=production`, `CORS_ORIGINS=https://dashboard-pi-flax-19.vercel.app`.
- Deployed via `railway up -s api`. Public domain generated:
  `https://api-production-57d8.up.railway.app`.
- Verified: `/health` → `{"status":"ok",...}`, `/api/feed` → live feed JSON,
  CORS allows the Vercel dashboard origin.

**Follow-up (not yet done)**: add a Railway volume mounted at
`/app/apps/api/data` so the SQLite DB survives redeploys (currently ephemeral —
fine for the demo, but data resets on every redeploy). Volumes aren't
exposed via the Railway CLI; add one from the Railway dashboard
(service `api` → Settings → Volumes).

---

## Step 2 — Deploy contracts to mantleSepolia (testnet) — DONE

Mainnet deploy is blocked (agent wallet has 0 MNT). Deployed to mantleSepolia
(chainId 5003) instead — already configured in `packages/contracts/hardhat.config.ts`.

The agent wallet `0x844771526F13d7a16d3135F7486545D61e81913C` was funded with
10 MNT, then all 4 contracts were deployed in one transaction batch via:
```bash
pnpm --filter @mantle-edge/contracts deploy:all:mantleSepolia
```
This wrote `packages/contracts/deployments/mantleSepolia.json` and the
addresses are set in `.env` and on the `agent` Railway service:
```
AGENT_IDENTITY_REGISTRY_ADDRESS=0x6EA3EA91896CBA417570F58B25f44ec4BE004ea1
LOG_REGISTRY_ADDRESS=0xeB4848E15DaE5881300479f9BF057DbAf86F4D4b
AGENT_IDENTITY_NFT_ADDRESS=0xE355E725c60eea454a9ba47dD57e65A5650cb119
TRADE_LOGGER_ADDRESS=0x1Ef136f9dd6eA3A9f13Fb840854Ee3F5a2976628
```
Verify on the explorer: `https://explorer.sepolia.mantle.xyz/address/<addr>`.

---

## Step 3 — Vercel dashboard env vars — DONE

All set for Production, Preview, and Development:
- `NEXT_PUBLIC_AGENT_ADDRESS=0x844771526F13d7a16d3135F7486545D61e81913C`
- `NEXT_PUBLIC_MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz`
- `NEXT_PUBLIC_MANTLE_CHAIN_ID=5003`
- `NEXT_PUBLIC_EXPLORER=https://explorer.sepolia.mantle.xyz`
- `NEXT_PUBLIC_TRADE_LOGGER=0x1Ef136f9dd6eA3A9f13Fb840854Ee3F5a2976628`
- `NEXT_PUBLIC_API_URL=https://api-production-57d8.up.railway.app`

Production redeployed via `vercel --prod` to bake in the new build-time
`NEXT_PUBLIC_*` values. `apps/dashboard/src/lib/feed.ts` polls
`${NEXT_PUBLIC_API_URL}/api/feed` every 10s and falls back to the bundled
`public/data/agent-feed.json` only if that request fails.

---

## Step 4 — `apps/agent` — DONE

- Service `agent` created in the `mantle-edge` Railway project.
- Variables set (see `railway variable list --service agent --kv`):
  `RAILWAY_DOCKERFILE_PATH=apps/agent/Dockerfile`, `NODE_ENV=production`,
  `MANTLE_RPC_URL`, `MANTLE_CHAIN_ID`, `AGENT_PRIVATE_KEY`, `BYBIT_TESTNET`,
  `BYBIT_SYMBOL`, `ANTHROPIC_MODEL`, `TRADING_PAIR`, `AGENT_POLL_INTERVAL_MS`,
  `MAX_TRADE_SIZE_USD`, `MIN_CONFIDENCE`, `EXECUTION_VENUE=dex`,
  `AGENT_IDENTITY_REGISTRY_ADDRESS`, `LOG_REGISTRY_ADDRESS`,
  `AGENT_IDENTITY_NFT_ADDRESS`, `TRADE_LOGGER_ADDRESS`, `DATA_DIR`,
  `STARTING_EQUITY_USD`, `RISK_*`, `ORCHESTRATOR_CYCLE_MS`,
  `REPORTER_INTERVAL_MS`, `API_URL=https://api-production-57d8.up.railway.app`.
- `BYBIT_API_KEY`/`BYBIT_SECRET`/`ANTHROPIC_API_KEY`/`OPENAI_API_KEY` left
  unset (same as local `.env`) — agent falls back to public market data +
  rule-based strategy.
- Deployed via `railway up -s agent`. Public domain generated:
  `https://agent-production-b53f.up.railway.app`.
- Verified: `/health` → `{"status":"ok","uptimeSeconds":...}`.

---

## Step 5 — Verify the full pipeline — DONE

1. ✅ `curl https://agent-production-b53f.up.railway.app/health` → `{"status":"ok",...}`
2. ✅ `curl https://api-production-57d8.up.railway.app/api/feed` → live feed,
   `status: "RUNNING"`, fresh decisions with real timestamps from the deployed
   agent.
3. ✅ CORS allows `https://dashboard-pi-flax-19.vercel.app`.
4. ⏳ On-chain `LogRegistry`/`TradeLogger` events — agent wallet nonce is still
   4 (just the 4 contract deployments) as of this check. The
   `ORCHESTRATOR_CYCLE_MS=300000` (5 min) cycle needs to run with a decision
   above `MIN_CONFIDENCE` for an on-chain `logAction` tx to fire. Re-check
   `https://explorer.sepolia.mantle.xyz/address/0x844771526F13d7a16d3135F7486545D61e81913C`
   after a few cycles.
5. Open https://dashboard-pi-flax-19.vercel.app — should show live data from
   the Railway API (not the static fallback).

Proceed to the demo run in `DEMO.md`.
