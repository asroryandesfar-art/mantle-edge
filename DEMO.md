# MantleEdge — Demo Script & Submission Checklist

## 0. Pre-flight (do this before the 30-minute run)

See `RAILWAY_DEPLOY.md` for the full deploy procedure (apps/api + apps/agent
on Railway, dashboard on Vercel).

- [x] `packages/contracts/deployments/mantleSepolia.json` has real (non-null)
      addresses (mainnet deploy is blocked — agent wallet has 0 MNT, see
      `RAILWAY_DEPLOY.md` Step 2)
- [x] `.env` / Railway agent service vars have `AGENT_IDENTITY_NFT_ADDRESS`,
      `TRADE_LOGGER_ADDRESS`, `LOG_REGISTRY_ADDRESS`,
      `AGENT_IDENTITY_REGISTRY_ADDRESS` set to the deployed testnet addresses
- [x] Agent wallet (`AGENT_PRIVATE_KEY`'s address) has enough testnet MNT for
      ~30 min of gas (10 MNT funded — decision/execution logging txs are
      cheap, but budget for several)
- [x] `apps/api` is deployed on Railway with a public domain
      (`https://api-production-57d8.up.railway.app`), and the dashboard's
      `NEXT_PUBLIC_API_URL` points to it
- [x] Dashboard shows live data via `GET /api/feed` (not the stale bundled
      `agent-feed.json` fallback)
- [x] Agent process is running on Railway and `/health` returns
      `{"status":"ok"}` at `https://agent-production-b53f.up.railway.app/health`

**Status: all of the above are LIVE in production** — see `RAILWAY_DEPLOY.md`
and the root `README.md` for full deployment links and architecture.

## 1. The 30-minute run

The agent is **already running 24/7 on Railway** — no setup needed to demo.
To watch a fresh run instead:

1. Open the [live dashboard](https://dashboard-pi-flax-19.vercel.app) and leave
   it open — it polls `apps/api`'s `/api/feed` every 10s.
2. Confirm the agent's health endpoint:
   ```bash
   curl https://agent-production-b53f.up.railway.app/health
   ```
3. Watch the orchestrator run (`ORCHESTRATOR_CYCLE_MS`, default 5 min). Over
   ~30 minutes you'll see ~6 cycles, each producing fresh decisions for
   BTC/USDT, ETH/USDT and MNT/USDT.
4. The "Smart Contracts on Mantle" panel on the dashboard links straight to
   each contract on the explorer.

To run a local instance instead, see `RAILWAY_DEPLOY.md` and the root
`README.md` "Local Development" section.

## 2. What to capture for judges

Capture these as you go (screenshots + short screen recording):

- [ ] **3+ decisions made** — the **"Agent Decisions"** panel on the dashboard
      showing asset/direction/confidence/reasoning, refreshing every cycle
- [ ] **On-chain audit trail** — `ActionLogged` events emitted by the agent
      wallet to `LogRegistry` (active every cycle) — view via the
      `LogRegistry` link in "Smart Contracts on Mantle" → the agent wallet's
      transaction list
- [ ] **Dashboard updating live** — record a short clip showing the feed
      timestamp / metrics changing between two refreshes without a manual
      page reload
- [ ] **Agent identity NFT** — `/identity` page showing the on-chain
      `AgentIdentityNFT` (token #1), owner wallet, birth block, and network —
      all live RPC reads from Mantle Sepolia
- [ ] *(optional)* **Executed trade with real tx hash** — a trade in
      `/history` with an `EXPLORER` link (vs. `PAPER TRADE`), if a DEX swap
      executed successfully on the configured network

## 3. On-chain links

Mantle Sepolia (testnet) explorer base: `https://explorer.sepolia.mantle.xyz`
(see `packages/contracts/deployments/mantleSepolia.json` for the source of truth)

| Item | Address | Explorer link |
|---|---|---|
| AgentIdentityRegistry contract | `0x6EA3EA91896CBA417570F58B25f44ec4BE004ea1` | https://explorer.sepolia.mantle.xyz/address/0x6EA3EA91896CBA417570F58B25f44ec4BE004ea1 |
| LogRegistry contract (live audit log) | `0xeB4848E15DaE5881300479f9BF057DbAf86F4D4b` | https://explorer.sepolia.mantle.xyz/address/0xeB4848E15DaE5881300479f9BF057DbAf86F4D4b |
| AgentIdentityNFT contract | `0xE355E725c60eea454a9ba47dD57e65A5650cb119` | https://explorer.sepolia.mantle.xyz/address/0xE355E725c60eea454a9ba47dD57e65A5650cb119 |
| TradeLogger contract | `0x1Ef136f9dd6eA3A9f13Fb840854Ee3F5a2976628` | https://explorer.sepolia.mantle.xyz/address/0x1Ef136f9dd6eA3A9f13Fb840854Ee3F5a2976628 |
| Agent wallet (all txs) | `0x844771526F13d7a16d3135F7486545D61e81913C` | https://explorer.sepolia.mantle.xyz/address/0x844771526F13d7a16d3135F7486545D61e81913C |

Individual decision/execution `ActionLogged` transaction hashes change every
cycle — find the latest ones under the agent wallet's transaction list above,
or filter the `LogRegistry` contract's "Events" tab for `ActionLogged`.

## 4. Demo video (2-3 min) outline

1. (0:00-0:20) One-line pitch: what MantleEdge is and the architecture
   (multi-agent: Analyst → RiskManager → Executor → Reporter, on Mantle).
2. (0:20-0:50) Show the live dashboard: position, metrics, decision feed,
   "Smart Contracts on Mantle" panel.
3. (0:50-1:30) Click through to the `LogRegistry` contract on
   `explorer.sepolia.mantle.xyz` and show recent `ActionLogged` events from
   the agent wallet — the on-chain audit trail.
4. (1:30-2:10) Show `/identity` (on-chain `AgentIdentityNFT` — owner,
   birth block, network, lifetime trades/PnL), explain the ERC-8004-inspired
   identity model.
5. (2:10-2:45) Show `/health` on the Railway-deployed agent to demonstrate it
   runs as a resilient, always-on service.
6. (2:45-3:00) Closing: repo link, contract addresses, roadmap.

## 5. Final submission checklist

- [x] GitHub repo link (public): https://github.com/asroryandesfar-art/mantle-edge
- [x] Live dashboard URL: https://dashboard-pi-flax-19.vercel.app
- [x] Contract addresses on Mantle Sepolia (chainId 5003):
  - AgentIdentityNFT: `0xE355E725c60eea454a9ba47dD57e65A5650cb119`
  - TradeLogger: `0x1Ef136f9dd6eA3A9f13Fb840854Ee3F5a2976628`
  - AgentIdentityRegistry: `0x6EA3EA91896CBA417570F58B25f44ec4BE004ea1`
  - LogRegistry: `0xeB4848E15DaE5881300479f9BF057DbAf86F4D4b`
- [ ] Demo video (2-3 min): `<fill in>`
- [ ] DoraHacks submission form filled
