"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { DirectionBadge } from "@/components/dashboard/DirectionBadge"
import { TerminalHeader } from "@/components/dashboard/TerminalHeader"
import { StatCard } from "@/components/dashboard/StatCard"
import { Card, CardContent } from "@/components/ui/card"
import { ExternalLink, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { FEED_URL, FEED_REFRESH_INTERVAL_MS, fetcher } from "@/lib/feed"

export default function HistoryPage() {
  const { data, error } = useSWR(FEED_URL, fetcher, { refreshInterval: FEED_REFRESH_INTERVAL_MS })
  const [search, setSearch] = useState("")

  const trades = useMemo(() => {
    if (!data) return []
    const query = search.trim().toLowerCase()
    if (!query) return data.trades
    return data.trades.filter((t: { asset: string }) => t.asset.toLowerCase().includes(query))
  }, [data, search])

  if (error) return <div className="p-8 text-destructive">Error loading trade history</div>
  if (!data) return <div className="p-8 text-muted-foreground animate-pulse">Loading history...</div>

  return (
    <div className="flex flex-col min-h-screen">
      <TerminalHeader terminalId={data.terminalId} gasPrice={data.gasPrice} agentAddress={data.agentAddress} />

      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground uppercase tracking-widest">Trade History</h1>
            <p className="text-xs text-muted-foreground mt-1">Full execution log synced from on-chain transactions.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by asset..."
                className="pl-8 h-9 w-48 bg-muted/20 border-border/50 text-xs"
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">{trades.length} / {data.trades.length} Executions</span>
          </div>
        </div>

        <Card className="bg-card border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow className="border-border/50">
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider">Time</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider">Asset</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider">Direction</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Size</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Entry</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Exit</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Confidence</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">PnL</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((t: { time: string; asset: string; direction: "LONG" | "SHORT" | "WAIT"; confidence: number; size: string; entryPrice: string; exitPrice: string; pnl: string; txHash: string }, i: number) => (
                  <TableRow key={i} className="border-border/30 hover:bg-muted/5 transition-colors">
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {new Date(t.time).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary shrink-0">
                          {t.asset.slice(0, 1)}
                        </div>
                        <span className="text-xs font-bold text-foreground">{t.asset}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DirectionBadge direction={t.direction} />
                    </TableCell>
                    <TableCell className="text-xs font-mono text-right text-muted-foreground">{t.size}</TableCell>
                    <TableCell className="text-xs font-mono text-right text-muted-foreground">{t.entryPrice}</TableCell>
                    <TableCell className="text-xs font-mono text-right text-muted-foreground">{t.exitPrice}</TableCell>
                    <TableCell className="text-xs font-mono text-right">{t.confidence}%</TableCell>
                    <TableCell className={cn("text-xs font-bold text-right", t.pnl.startsWith("+") ? "text-success" : "text-destructive")}>
                      {t.pnl}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`https://explorer.mantle.xyz/tx/${t.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-[10px] font-bold text-primary hover:underline"
                      >
                        EXPLORER <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Win Rate"
            value={data.metrics.winRate}
            accentClassName="border-l-success"
            subtitle={`Across ${data.metrics.tradeCount} trades`}
          />
          <StatCard
            label="Total PnL (30D)"
            value={data.metrics.pnl}
            valueClassName="text-success"
            accentClassName="border-l-primary"
            subtitle="Cumulative agent performance"
          />
          <StatCard
            label="Agent Contribution"
            value={`${data.metrics.agentContributionPct}%`}
            accentClassName="border-l-border"
            subtitle={`${data.metrics.agentContributionTrades} of ${data.metrics.tradeCount} trades autonomous`}
          />
        </div>
      </main>
    </div>
  )
}
