"use client"

import { Wallet, AlertTriangle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { shortenAddress, useWallet, TARGET_CHAIN } from "@/lib/wallet"

interface WalletConnectButtonProps {
  className?: string
}

export function WalletConnectButton({ className }: WalletConnectButtonProps) {
  const { hasProvider, address, wrongNetwork, connect, switchNetwork } = useWallet()

  if (!hasProvider) {
    return (
      <Button
        onClick={connect}
        variant="outline"
        className={cn("w-full font-bold border-border/50 text-muted-foreground hover:text-foreground", className)}
      >
        <Download className="w-4 h-4 mr-2" />
        Install Wallet
      </Button>
    )
  }

  if (address && wrongNetwork) {
    return (
      <Button
        onClick={switchNetwork}
        variant="outline"
        className={cn("w-full font-bold border-destructive/50 text-destructive hover:bg-destructive/10", className)}
      >
        <AlertTriangle className="w-4 h-4 mr-2" />
        Switch to {TARGET_CHAIN.name}
      </Button>
    )
  }

  return (
    <Button
      onClick={connect}
      variant={address ? "outline" : "default"}
      className={cn(
        "w-full font-bold",
        address
          ? "border-success text-success hover:bg-success/10"
          : "bg-primary text-primary-foreground hover:bg-primary/90",
        className,
      )}
    >
      <Wallet className="w-4 h-4 mr-2" />
      {address ? shortenAddress(address) : "Connect Wallet"}
    </Button>
  )
}
