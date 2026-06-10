"use client"

import { useEffect, useState } from "react"

interface PriceData {
  symbol: string
  price: string
  change: string
}

export function LiveTicker() {
  const [prices, setPrices] = useState<PriceData[]>([
    { symbol: "MNTUSDT", price: "0.8542", change: "+2.4%" },
    { symbol: "BTCUSDT", price: "68234.1", change: "-0.5%" },
    { symbol: "ETHUSDT", price: "3842.15", change: "+1.2%" },
    { symbol: "WMNTUSDC", price: "0.8545", change: "+2.3%" },
  ])

  useEffect(() => {
    const ws = new WebSocket("wss://stream.bybit.com/v5/public/linear")
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        op: "subscribe",
        args: ["tickers.MNTUSDT", "tickers.BTCUSDT", "tickers.ETHUSDT"]
      }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.topic?.startsWith("tickers")) {
        const ticker = data.data
        setPrices(prev => prev.map(p => {
          if (p.symbol === ticker.symbol) {
            return {
              ...p,
              price: ticker.lastPrice,
              change: (parseFloat(ticker.price24hPcnt) * 100).toFixed(2) + "%"
            }
          }
          return p
        }))
      }
    }

    return () => ws.close()
  }, [])

  return (
    <div className="w-full bg-muted/20 border-y border-border overflow-hidden py-1.5 flex whitespace-nowrap">
      <div className="animate-marquee flex gap-12 px-4">
        {[...prices, ...prices].map((p, i) => (
          <div key={i} className="flex gap-2 text-xs font-mono">
            <span className="text-muted-foreground">{p.symbol}</span>
            <span className="text-foreground font-bold">{p.price}</span>
            <span className={p.change.startsWith("+") ? "text-success" : "text-destructive"}>
              {p.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
