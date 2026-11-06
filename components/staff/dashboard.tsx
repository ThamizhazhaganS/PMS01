import { cn } from "@/lib/utils"
import type { totals } from "@/lib/portfolio"

type Totals = ReturnType<typeof totals>

/** Stacked health bar: how many live projects are On Track / At Risk / Delayed. */
export function HealthBar({ health, className }: { health: Totals["health"]; className?: string }) {
  const sum = health.on_track + health.at_risk + health.delayed + health.none
  if (!sum) return <div className={cn("h-2 rounded-full bg-muted", className)} />
  const seg = (n: number, cls: string, label: string) =>
    n > 0 && <span className={cls} style={{ width: `${(n / sum) * 100}%` }} title={`${n} ${label}`} />
  return (
    <div className={cn("flex h-2 gap-0.5 overflow-hidden rounded-full", className)} role="img" aria-label={`${health.on_track} on track, ${health.at_risk} at risk, ${health.delayed} delayed`}>
      {seg(health.on_track, "bg-ok", "on track")}
      {seg(health.at_risk, "bg-warn", "at risk")}
      {seg(health.delayed, "bg-bad", "delayed")}
      {seg(health.none, "bg-muted-foreground/30", "no status")}
    </div>
  )
}
