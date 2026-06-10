"use client"

import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface ConfidenceBarProps {
  value: number
  className?: string
}

export function ConfidenceBar({ value, className }: ConfidenceBarProps) {
  const getColor = (v: number) => {
    if (v < 50) return "bg-destructive"
    if (v < 75) return "bg-yellow-500"
    return "bg-success"
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground font-medium">Confidence</span>
        <span className="font-bold text-foreground">{value}%</span>
      </div>
      <Progress 
        value={value} 
        className="h-2 bg-muted/30" 
        indicatorClassName={getColor(value)}
      />
    </div>
  )
}
