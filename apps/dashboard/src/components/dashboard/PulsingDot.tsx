import { cn } from "@/lib/utils"

interface PulsingDotProps {
  className?: string
}

/** Small animated "live" indicator dot. */
export function PulsingDot({ className }: PulsingDotProps) {
  return (
    <span className="relative flex h-2 w-2">
      <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", className ?? "bg-success")} />
      <span className={cn("relative inline-flex rounded-full h-2 w-2", className ?? "bg-success")} />
    </span>
  )
}
