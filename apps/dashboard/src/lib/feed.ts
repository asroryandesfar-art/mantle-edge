/**
 * URL the dashboard polls for live agent state.
 *
 * Defaults to the bundled static snapshot (`public/data/agent-feed.json`).
 * Set `NEXT_PUBLIC_AGENT_FEED_URL` to the deployed agent's `/agent-feed.json`
 * endpoint (see apps/agent/src/healthServer.ts) to show live data when the
 * dashboard and agent run as separate deployments.
 */
export const FEED_URL = process.env.NEXT_PUBLIC_AGENT_FEED_URL || "/data/agent-feed.json";

/** Polling interval (ms) for live-updating views. */
export const FEED_REFRESH_INTERVAL_MS = 10_000;

export const fetcher = (url: string) => fetch(url).then((res) => res.json());
