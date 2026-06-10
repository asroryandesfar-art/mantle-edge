"use client"

import { Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { shortenAddress, useWallet } from "@/lib/wallet"

interface WalletConnectButtonProps {
  className?: string
}

export function WalletConnectButton({ className }: WalletConnectButtonProps) {
  const { address, connect } = useWallet()

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
