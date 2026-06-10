import { PulsingDot } from "./PulsingDot"
import { shortenAddress } from "@/lib/wallet"

interface TerminalHeaderProps {
  terminalId: string
  gasPrice: string
  agentAddress: string
}

/** Slim top bar showing live status, terminal/gas info, and the agent's wallet address. */
export function TerminalHeader({ terminalId, gasPrice, agentAddress }: TerminalHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 py-3 border-b border-border/50 text-[11px] font-mono">
      <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
        <span className="flex items-center gap-1.5 font-bold text-success">
          <PulsingDot />
          SYSTEM LIVE
        </span>
        <span>
          TERMINAL_ID: <span className="text-foreground">{terminalId}</span>
        </span>
        <span className="text-success font-bold">Gas: {gasPrice}</span>
      </div>
      <div className="px-3 py-1 rounded-md bg-muted/30 border border-border/50 font-bold text-foreground">
        {shortenAddress(agentAddress)}
      </div>
    </div>
  )
}
