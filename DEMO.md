# MantleEdge — Demo Script & Submission Checklist

## 0. Pre-flight (do this before the 30-minute run)

- [ ] `packages/contracts/deployments/mantle.json` has real (non-null) addresses
- [ ] `.env` has `AGENT_IDENTITY_NFT_ADDRESS`, `TRADE_LOGGER_ADDRESS`, `LOG_REGISTRY_ADDRESS`,
      `AGENT_IDENTITY_REGISTRY_ADDRESS` set to the deployed addresses
- [ ] Agent wallet (`AGENT_PRIVATE_KEY`'s address) has enough MNT for ~30 min of gas
      (decision/execution logging txs are cheap, but budget for several)
- [ ] Dashboard is deployed and pointed at the live `agent-feed.json` (not stale mock data)
- [ ] Agent process is running (PM2/Docker) and `/health` returns `{"status":"ok"}`

## 1. The 30-minute run

1. Start the agent (if not already running as a service):
   ```bash
   pnpm --filter @mantle-edge/agent start:multiagent
   # or: pm2 start apps/agent/ecosystem.config.cjs
   ```
2. Confirm health endpoint:
   ```bash
   curl http://<agent-host>:3001/health
   ```
3. Let the orchestrator run for ~30 minutes (`ORCHESTRATOR_CYCLE_MS`, default 5 min ⇒ ~6 cycles).
4. Open the live dashboard in a browser tab and leave it open — it polls
   `agent-feed.json` and should visibly update across cycles.

## 2. What to capture for judges

Capture these as you go (screenshots + short screen recording):

- [ ] **3 decisions made** — `DecisionLogged` events on-chain (TradeLogger) AND the
      "Decisions" panel on the dashboard showing asset/direction/confidence/reasoning
- [ ] **1 executed trade** — `ExecutionLogged` event (TradeLogger) AND the trade
      appearing in the dashboard's trade history page
- [ ] **Dashboard updating live** — record a short clip showing the feed timestamp /
      metrics changing between two refreshes without a manual page reload
- [ ] **Agent identity NFT** — `agentName`, `totalTrades`, `totalPnL` on
      `AgentIdentityNFT` reflecting the run (via `identity` page or block explorer)

## 3. On-chain links (fill in after the run)

Mantle mainnet explorer base: `https://explorer.mantle.xyz`

| Item | Address / Tx | Explorer link |
|---|---|---|
| AgentIdentityNFT contract | `<from deployments/mantle.json>` | `https://explorer.mantle.xyz/address/<addr>` |
| TradeLogger contract | `<from deployments/mantle.json>` | `https://explorer.mantle.xyz/address/<addr>` |
| Decision tx #1 | `<tx hash>` | `https://explorer.mantle.xyz/tx/<hash>` |
| Decision tx #2 | `<tx hash>` | `https://explorer.mantle.xyz/tx/<hash>` |
| Decision tx #3 | `<tx hash>` | `https://explorer.mantle.xyz/tx/<hash>` |
| Execution tx | `<tx hash>` | `https://explorer.mantle.xyz/tx/<hash>` |
| `updateStats` tx | `<tx hash>` | `https://explorer.mantle.xyz/tx/<hash>` |

## 4. Demo video (2-3 min) outline

1. (0:00-0:20) One-line pitch: what MantleEdge is and the architecture
   (multi-agent: Analyst → RiskManager → Executor → Reporter, on Mantle).
2. (0:20-0:50) Show the live dashboard: position, metrics, decision feed.
3. (0:50-1:30) Show one decision → execution flow end-to-end, then jump to the
   matching `DecisionLogged`/`ExecutionLogged` tx on `explorer.mantle.xyz`.
4. (1:30-2:10) Show the `AgentIdentityNFT` (identity page + on-chain `ownerOf`/
   `totalTrades`/`totalPnL`), explain the ERC-8004-inspired identity model.
5. (2:10-2:45) Show `pm2 status` / `/health` to demonstrate the agent runs as a
   resilient long-running service.
6. (2:45-3:00) Closing: repo link, contract addresses, what's next.

## 5. Final submission checklist

- [x] GitHub repo link (public): https://github.com/asroryandesfar-art/mantle-edge
- [x] Live dashboard URL: https://dashboard-pi-flax-19.vercel.app
- [ ] Contract addresses on Mantle:
  - AgentIdentityNFT: `<fill in>`
  - TradeLogger: `<fill in>`
  - AgentIdentityRegistry: `<fill in>`
  - LogRegistry: `<fill in>`
- [ ] Demo video (2-3 min): `<fill in>`
- [ ] DoraHacks submission form filled
