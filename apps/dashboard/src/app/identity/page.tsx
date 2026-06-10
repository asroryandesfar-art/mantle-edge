"use client"

import useSWR from "swr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TerminalHeader } from "@/components/dashboard/TerminalHeader"
import { PulsingDot } from "@/components/dashboard/PulsingDot"
import { Fingerprint, ShieldCheck, Globe, Cpu, Activity, Zap } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function IdentityPage() {
  const { data, error } = useSWR("/data/agent-feed.json", fetcher)

  if (error) return <div className="p-8 text-destructive">Error loading agent identity</div>
  if (!data) return <div className="p-8 text-muted-foreground animate-pulse">Fetching Agent Identity from Mantle...</div>

  const identity = data.identity

  return (
    <div className="flex flex-col min-h-screen">
      <TerminalHeader terminalId={data.terminalId} gasPrice={data.gasPrice} agentAddress={data.agentAddress} />

      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black tracking-tighter uppercase tracking-widest">Agent Identity</h1>
          <p className="text-muted-foreground text-sm font-medium">ERC-8004 Proof of Autonomous Agency</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Portrait Card */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-success rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
            <Card className="relative aspect-[3/4] bg-[#0a0a0f] border-primary/20 overflow-hidden flex flex-col gap-0 py-0">
              <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <div className="absolute inset-0 bg-[radial-gradient(#8b5cf6_1px,transparent_1px)] [background-size:20px_20px]"></div>
              </div>
              <CardHeader className="p-6">
                <div className="flex justify-between items-start">
                  <Badge className="bg-primary text-primary-foreground font-bold text-[10px]">ERC-8004 STANDARD</Badge>
                  <Fingerprint className="w-6 h-6 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center items-center text-center p-8 space-y-6">
                <div className="w-32 h-32 rounded-full border-2 border-primary p-1 flex items-center justify-center relative">
                  <div className="absolute inset-0 animate-spin-slow border-t-2 border-primary rounded-full"></div>
                  <div className="w-full h-full rounded-full bg-muted/20 flex items-center justify-center">
                    <ShieldCheck className="w-12 h-12 text-primary" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-black text-foreground">{identity.name}</h2>
                  <p className="text-primary font-mono text-xs">#{identity.tokenId}</p>
                </div>
              </CardContent>
              <div className="p-6 border-t border-border/50 bg-muted/10 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Net PnL</p>
                  <p className="text-sm font-black text-success">{identity.totalPnl}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Lifetime Trades</p>
                  <p className="text-sm font-black text-foreground">{identity.totalTrades}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Specs + Verification */}
          <div className="space-y-6">
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-primary" /> Agent Specs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "Identifier", value: identity.identifier },
                  { label: "Value Managed", value: identity.valueManaged },
                  { label: "Birth Block", value: identity.birthBlock },
                  { label: "Uptime Signature", value: identity.uptimeSignature },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center border-b border-border/30 pb-2 gap-4">
                    <span className="text-xs text-muted-foreground font-medium">{item.label}</span>
                    <span className="text-xs font-mono text-foreground font-bold truncate">{item.value}</span>
                  </div>
                ))}
                <div className="pt-1">
                  <p className="text-xs text-muted-foreground font-medium mb-2">Authorized Schemes</p>
                  <div className="flex flex-wrap gap-2">
                    {identity.authorizedSchemes.map((scheme: string) => (
                      <Badge key={scheme} variant="outline" className="text-[10px] font-bold border-border/50 text-foreground">
                        {scheme}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" /> On-Chain Verification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Owner Wallet", value: identity.owner },
                  { label: "Network", value: identity.metadata.network },
                  { label: "Model Architecture", value: identity.metadata.model },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
                      <p className="text-xs font-mono text-foreground font-bold truncate">{item.value}</p>
                    </div>
                    <Badge variant="outline" className="border-success/30 text-success text-[10px] font-bold gap-1 shrink-0">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Telemetry + Autonomy */}
        <div className="grid sm:grid-cols-2 gap-6">
          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Telemetry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">API Latency</span>
                <span className="font-bold text-success">{data.apiLatencyMs}ms</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Gas Price</span>
                <span className="font-bold text-foreground">{data.gasPrice}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Uptime</span>
                <span className="font-bold text-foreground">{data.uptime}</span>
              </div>
              <div className="flex items-center gap-4 pt-1">
                <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${identity.trustScore}%` }} />
                </div>
                <span className="text-xs font-bold text-primary whitespace-nowrap">{identity.trustScore} Trust Score</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50">
            <CardHeader>
              <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                <Zap className="w-4 h-4 text-success" /> Autonomy Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <PulsingDot />
                <span className="text-xs font-bold text-success uppercase tracking-widest">{data.status}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Operating fully autonomously under {identity.authorizedSchemes[0]}. {identity.metadata.strategy} strategy
                executed via {identity.metadata.model}.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
