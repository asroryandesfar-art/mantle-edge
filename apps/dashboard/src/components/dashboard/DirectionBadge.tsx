import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface DirectionBadgeProps {
  direction: "LONG" | "SHORT" | "WAIT"
  className?: string
}

export function DirectionBadge({ direction, className }: DirectionBadgeProps) {
  const variants = {
    LONG: "bg-success/10 text-success border-success/20 hover:bg-success/20",
    SHORT: "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20",
    WAIT: "bg-muted/50 text-muted-foreground border-muted hover:bg-muted/70",
  }

  return (
    <Badge variant="outline" className={cn("px-2 py-0.5 font-bold uppercase tracking-wider", variants[direction], className)}>
      {direction}
    </Badge>
  )
}
