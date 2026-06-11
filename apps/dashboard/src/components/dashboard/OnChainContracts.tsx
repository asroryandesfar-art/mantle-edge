import { ExternalLink, Link2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TARGET_CHAIN, shortenAddress } from "@/lib/wallet"
import { DEPLOYED_CONTRACTS, explorerAddressUrl } from "@/lib/contracts"

/** Card listing every smart contract MantleEdge has deployed on-chain, with explorer links. */
export function OnChainContracts() {
  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="border-b border-border/30 px-6 py-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" /> Smart Contracts on Mantle
        </CardTitle>
        <Badge variant="outline" className="border-success/30 text-success text-[10px] font-bold">
          {TARGET_CHAIN.name}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border/30">
          {DEPLOYED_CONTRACTS.map((contract) => (
            <li key={contract.address} className="flex items-center justify-between gap-4 px-6 py-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground">{contract.name}</div>
                <p className="text-[11px] text-muted-foreground truncate">{contract.description}</p>
              </div>
              <a
                href={explorerAddressUrl(contract.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-mono font-bold text-primary hover:underline"
              >
                {shortenAddress(contract.address)}
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
