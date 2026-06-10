import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: ReactNode
  valueClassName?: string
  /** Tailwind border-color class applied as a 4px left accent. */
  accentClassName?: string
  subtitle?: ReactNode
  children?: ReactNode
  className?: string
}

/** A single metric tile with a label, headline value, and optional accent border / footer content. */
export function StatCard({
  label,
  value,
  valueClassName,
  accentClassName = "border-l-border",
  subtitle,
  children,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("bg-card border-border/50 border-l-4 gap-2", accentClassName, className)}>
      <CardContent className="pt-6">
        <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mb-2">
          {label}
        </div>
        <div className={cn("text-2xl font-black text-foreground", valueClassName)}>{value}</div>
        {subtitle ? <p className="text-[11px] text-muted-foreground mt-1.5">{subtitle}</p> : null}
        {children}
      </CardContent>
    </Card>
  )
}
