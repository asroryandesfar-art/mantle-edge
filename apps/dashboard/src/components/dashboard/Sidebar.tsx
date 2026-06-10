"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { History, LayoutDashboard, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { PulsingDot } from "./PulsingDot"
import { WalletConnectButton } from "./WalletConnectButton"

const NAV_LINKS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Trade History", href: "/history", icon: History },
  { label: "Agent Identity", href: "/identity", icon: User },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="w-full md:w-64 md:h-screen md:sticky md:top-0 bg-card border-b md:border-b-0 md:border-r border-border/50 p-6 flex flex-col gap-8 shrink-0">
      <div>
        <h1 className="text-xl font-black tracking-tight">
          Mantle<span className="text-primary">Edge</span>
        </h1>
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1">
          AI Trading Terminal
        </p>
      </div>

      <div className="flex-1 space-y-1">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 rounded-lg border-l-2 transition-colors text-sm font-bold uppercase tracking-widest",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          )
        })}
      </div>

      <div className="space-y-3 pt-6 border-t border-border/30">
        <div className="flex items-center gap-2 px-1">
          <PulsingDot />
          <span className="text-xs font-mono font-bold text-foreground">Mantle Mainnet</span>
        </div>
        <WalletConnectButton />
      </div>
    </nav>
  )
}
