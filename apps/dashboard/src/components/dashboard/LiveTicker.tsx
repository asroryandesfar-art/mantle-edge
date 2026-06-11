"use client"

import useSWR from "swr"
import { FEED_URL, FEED_REFRESH_INTERVAL_MS, fetcher } from "@/lib/feed"

interface TickerEntry {
  symbol: string
  price: number
  changeVsEma20Pct: number
}

function formatPrice(price: number): string {
  if (price >= 100) return price.toFixed(2)
  if (price >= 1) return price.toFixed(3)
  return price.toFixed(4)
}

/** Scrolling marquee of live asset prices, sourced from the agent's own market data feed. */
export function LiveTicker() {
  const { data } = useSWR(FEED_URL, fetcher, { refreshInterval: FEED_REFRESH_INTERVAL_MS })
  const tickers: TickerEntry[] = data?.tickers ?? []

  if (tickers.length === 0) return null

  return (
    <div className="w-full bg-muted/20 border-y border-border overflow-hidden py-1.5 flex whitespace-nowrap">
      <div className="animate-marquee flex gap-12 px-4">
        {[...tickers, ...tickers].map((p, i) => (
          <div key={i} className="flex gap-2 text-xs font-mono">
            <span className="text-muted-foreground">{p.symbol}</span>
            <span className="text-foreground font-bold">{formatPrice(p.price)}</span>
            <span className={p.changeVsEma20Pct >= 0 ? "text-success" : "text-destructive"}>
              {p.changeVsEma20Pct >= 0 ? "+" : ""}
              {p.changeVsEma20Pct.toFixed(2)}% vs EMA20
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
