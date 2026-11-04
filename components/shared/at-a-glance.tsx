import type { timeView } from "@/lib/data"
import { fmtDate, relDays, todayIso } from "@/lib/domain/rules"
import { cn } from "@/lib/utils"

type TimeView = ReturnType<typeof timeView>

export const fmtHours = (h: number) => h.toLocaleString("en-IN", { maximumFractionDigits: 2 })
const asDays = (h: number, perDay: number) => fmtHours(Math.round((h / perDay) * 10) / 10)

/** Agreed time, time used, time left and remaining work in one card. */
export function AtAGlance({ t, action }: { t: TimeView; action?: React.ReactNode }) {
  const tone = t.usedPct === undefined ? "brand" : t.usedPct > 100 ? "bad" : t.usedPct >= 85 ? "warn" : "good"
  return (
    <section className="rounded-xl border bg-card p-5" aria-labelledby="glance-h">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="glance-h" className="eyebrow">Project at a glance</h2>
        {action}
      </div>
      <dl className="grid grid-cols-2 gap-5 md:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Agreed time</dt>
          {t.agreedHours !== undefined ? (
            <>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{fmtHours(t.agreedDays!)} days</dd>
              <dd className="text-xs text-muted-foreground tabular-nums">{fmtHours(t.agreedHours)} hours</dd>
            </>
          ) : (
            <dd className="mt-1 text-sm text-muted-foreground">Set when the estimate is approved</dd>
          )}
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Time used</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{asDays(t.loggedHours, t.hoursPerDay)} days</dd>
          <dd className="text-xs text-muted-foreground tabular-nums">{fmtHours(t.loggedHours)} hours{t.usedPct !== undefined && ` · ${t.usedPct}%`}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Time left</dt>
          {t.leftHours !== undefined ? (
            <>
              <dd className={cn("mt-1 text-lg font-semibold tabular-nums", t.leftHours < 0 && "text-bad")}>
                {t.leftHours < 0 ? `${asDays(-t.leftHours, t.hoursPerDay)} days over` : `${asDays(t.leftHours, t.hoursPerDay)} days`}
              </dd>
              <dd className="text-xs text-muted-foreground tabular-nums">{fmtHours(Math.abs(t.leftHours))} hours{t.leftHours < 0 && " over the agreed time"}</dd>
            </>
          ) : (
            <dd className="mt-1 text-sm text-muted-foreground">—</dd>
          )}
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Activities left</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{t.milestonesLeft + t.actionsLeft}</dd>
          <dd className="text-xs text-muted-foreground">
            {t.milestonesLeft} milestone{t.milestonesLeft === 1 ? "" : "s"} · {t.actionsLeft} action{t.actionsLeft === 1 ? "" : "s"}
          </dd>
        </div>
      </dl>
      {t.usedPct !== undefined && (
        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Agreed time used" aria-valuenow={t.usedPct} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn("h-full rounded-full", { "bg-ok": tone === "good", "bg-warn": tone === "warn", "bg-bad": tone === "bad" })} style={{ width: `${Math.min(100, t.usedPct)}%` }} />
          </div>
        </div>
      )}
      {t.nextDue && (
        <p className="mt-4 text-sm">
          <span className="text-muted-foreground">Next due: </span>
          <span className="font-medium">{t.nextDue.title}</span>
          <span className={cn(t.nextDue.due < todayIso() ? "text-bad" : "text-muted-foreground")}> · {fmtDate(t.nextDue.due)} · {t.nextDue.due < todayIso() ? `overdue, ${relDays(t.nextDue.due)}` : relDays(t.nextDue.due)}</span>
        </p>
      )}
    </section>
  )
}
