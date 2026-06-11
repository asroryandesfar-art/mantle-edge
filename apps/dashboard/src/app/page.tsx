"use client"

import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DirectionBadge } from "@/components/dashboard/DirectionBadge"
import { ConfidenceBar } from "@/components/dashboard/ConfidenceBar"
import { LiveTicker } from "@/components/dashboard/LiveTicker"
import { TerminalHeader } from "@/components/dashboard/TerminalHeader"
import { StatCard } from "@/components/dashboard/StatCard"
import { OnChainContracts } from "@/components/dashboard/OnChainContracts"
import { PulsingDot } from "@/components/dashboard/PulsingDot"
import { WalletConnectButton } from "@/components/dashboard/WalletConnectButton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { cn } from "@/lib/utils"
import { FEED_URL, FEED_REFRESH_INTERVAL_MS, fetcher } from "@/lib/feed"

const DECISION_BORDERS: Record<string, string> = {
  LONG: "border-success/40",
  SHORT: "border-destructive/40",
  WAIT: "border-border",
}

export default function DashboardPage() {
  const { data, error } = useSWR(FEED_URL, fetcher, { refreshInterval: FEED_REFRESH_INTERVAL_MS })

  if (error) return <div className="p-8 text-destructive">Error loading agent data</div>
  if (!data) return <div className="p-8 text-muted-foreground animate-pulse">Loading dashboard...</div>

  const chartData = [
    { name: "Day 1", agent: 0, human: 0 },
    { name: "Day 2", agent: 2.5, human: 1.2 },
    { name: "Day 3", agent: 4.8, human: -0.5 },
    { name: "Day 4", agent: 7.2, human: 2.1 },
    { name: "Day 5", agent: 12.45, human: 3.5 },
  ]

  const positionAccent = data.position.direction === "SHORT" ? "border-l-destructive" : "border-l-success"

  return (
    <div className="flex flex-col min-h-screen">
      <TerminalHeader terminalId={data.terminalId} gasPrice={data.gasPrice} agentAddress={data.agentAddress} />
      <LiveTicker />

      <main className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Hero status */}
        <Card className="bg-card border-border/50 border-l-4 border-l-success">
          <CardContent className="pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <PulsingDot />
                <span className="text-xs font-mono font-bold text-success uppercase tracking-widest">Agent is Live</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Mantle<span className="text-primary">Edge</span>{" "}
                <span className="text-muted-foreground text-base font-bold">v1.0</span>
              </h1>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="px-3 py-1.5 rounded-md bg-muted/30 border border-border/50 text-[11px] font-mono">
                UPTIME: <span className="text-foreground font-bold">{data.uptime}</span>
              </div>
              <div className="px-3 py-1.5 rounded-md bg-muted/30 border border-border/50 text-[11px] font-mono">
                LATENCY: <span className="text-success font-bold">{data.apiLatencyMs}ms</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total PnL"
            value={data.metrics.pnl}
            valueClassName="text-success"
            accentClassName="border-l-success"
            subtitle={`${data.metrics.totalTrades} paper trades`}
          />
          <StatCard
            label="Win Rate"
            value={data.metrics.winRate}
            accentClassName="border-l-primary"
            subtitle={`Avg confidence ${data.metrics.confidenceAvg}%`}
          />
          <StatCard
            label="On-Chain Executions"
            value={data.metrics.tradeCount}
            accentClassName="border-l-border"
            subtitle={`${data.metrics.failedExecutions} failed / ${data.metrics.totalTrades} total`}
          />
          <StatCard
            label="Active Position"
            value={data.position.pair}
            accentClassName={positionAccent}
            subtitle={`${data.position.leverage} · ${data.position.size} · ROA ${data.position.roa}`}
          >
            <div className="mt-2">
              <DirectionBadge direction={data.position.direction} />
            </div>
          </StatCard>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Decision Feed */}
          <Card className="lg:col-span-1 bg-card border-border/50 flex flex-col h-[600px]">
            <CardHeader className="border-b border-border/30 px-6 py-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Agent Decisions</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full px-6 py-4">
                <div className="space-y-6">
                  {data.decisions.map((d: any, i: number) => (
                    <div key={i} className={cn("border-l-2 pl-4 space-y-3 pb-2", DECISION_BORDERS[d.action] ?? "border-border")}>
                      <div className="flex justify-between items-start">
                        <DirectionBadge direction={d.action} />
                        <span className="text-[10px] font-mono text-muted-foreground">{new Date(d.time).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-xs font-bold text-foreground">{d.asset}</div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{d.reasoning}</p>
                      <ConfidenceBar value={d.confidence} />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Performance Comparison */}
          <Card className="lg:col-span-2 bg-card border-border/50">
            <CardHeader className="border-b border-border/30 px-6 py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Efficiency Comparison</CardTitle>
              <span className="text-xs font-mono font-bold text-success">{data.comparison.edge} Edge</span>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/20 border border-border/30">
                  <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-1">Your PnL</div>
                  <div className="text-2xl font-black text-foreground">{data.comparison.yourPnl}</div>
                </div>
                <div className="p-4 rounded-lg bg-success/5 border border-success/20">
                  <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-1">Agent PnL</div>
                  <div className="text-2xl font-black text-success">{data.comparison.agentPnl}</div>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a34" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#52525b"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis
                      stroke="#52525b"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1a1a24", border: "1px solid #2a2a34", borderRadius: "8px", fontSize: "12px" }}
                      itemStyle={{ fontWeight: "bold" }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: "20px", fontSize: "12px" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="agent"
                      name="Agent PnL"
                      stroke="#00ff88"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#00ff88", strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="human"
                      name="Human PnL"
                      stroke="#52525b"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 4, fill: "#52525b", strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Insight</div>
                  <p className="text-xs text-muted-foreground max-w-md">
                    MantleEdge outperformed manual trading by {data.comparison.edge} over the last 5 days.
                    Connect your wallet to sync your portfolio.
                  </p>
                </div>
                <WalletConnectButton className="w-full sm:w-auto shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* On-chain deployment */}
        <OnChainContracts />
      </main>
    </div>
  )
}
