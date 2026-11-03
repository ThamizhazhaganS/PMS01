"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { fmtDate, fmtShort } from "@/lib/domain/rules"
import type { DateChange } from "@/lib/domain/types"
import { History } from "lucide-react"

/**
 * UX-07: when the current date differs from the baseline, show both and
 * reveal the reason on hover or tap.
 */
export function MilestoneDates({ baseline, current, changes, compact }: { baseline?: string; current: string; changes: DateChange[]; compact?: boolean }) {
  const moved = baseline && baseline !== current
  const slip = moved ? Math.round((new Date(current).getTime() - new Date(baseline!).getTime()) / 864e5) : 0
  if (!moved)
    return (
      <span className="text-sm tabular-nums">
        {compact ? fmtShort(current) : fmtDate(current)}
        {!baseline && <span className="ml-1.5 text-xs text-muted-foreground">(baseline not yet frozen)</span>}
      </span>
    )
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        className="group inline-flex flex-wrap items-baseline gap-x-2 rounded text-left text-sm tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Moved from ${fmtDate(baseline)} to ${fmtDate(current)}. Show reason.`}
      >
        <span className="font-medium">{compact ? fmtShort(current) : fmtDate(current)}</span>
        <span className="text-xs text-muted-foreground line-through">{compact ? fmtShort(baseline) : fmtDate(baseline)}</span>
        <span className={slip > 0 ? "text-xs font-medium text-warn" : "text-xs font-medium text-ok"}>
          {slip > 0 ? `+${slip}d` : `${slip}d`}
        </span>
        <History className="size-3 self-center text-muted-foreground group-hover:text-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <p className="eyebrow">Why the date moved</p>
        <p className="text-xs text-muted-foreground">
          Original (baseline) {fmtDate(baseline)} · Current {fmtDate(current)}
        </p>
        <ol className="space-y-2">
          {changes.map((c, i) => (
            <li key={i} className="rounded-md bg-muted p-2 text-xs">
              <div className="font-medium tabular-nums">
                {fmtShort(c.from)} → {fmtShort(c.to)}
              </div>
              <p className="mt-0.5">{c.reason}</p>
              <p className="mt-0.5 text-muted-foreground">Linked to: {c.linkKind.replace("_", " ")}</p>
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  )
}
