/** Bundled static snapshot, written by apps/api on every decision/trade as a fallback. */
const FALLBACK_FEED_URL = "/data/agent-feed.json";

/**
 * URL the dashboard polls for live agent state.
 *
 * Set `NEXT_PUBLIC_API_URL` to the deployed @mantle-edge/api base URL (e.g.
 * `https://mantle-edge-api.up.railway.app`) to poll its `GET /api/feed`
 * endpoint directly. Falls back to the bundled static snapshot
 * (`public/data/agent-feed.json`) if that env var is unset, or if the live
 * request fails (e.g. the API is unreachable).
 */
export const FEED_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/feed`
  : FALLBACK_FEED_URL;

/** Polling interval (ms) for live-updating views. */
export const FEED_REFRESH_INTERVAL_MS = 10_000;

export const fetcher = async (url: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`feed request failed with status ${res.status}`);
    return await res.json();
  } catch (err) {
    if (url === FALLBACK_FEED_URL) throw err;
    const res = await fetch(FALLBACK_FEED_URL);
    return res.json();
  }
};
