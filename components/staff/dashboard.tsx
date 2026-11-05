import Link from "next/link"
import { Activity, ArrowUpRight, Ban, Building2, CircleDollarSign, Clock, Flag, type LucideIcon, PauseCircle, Stamp } from "lucide-react"
import type { AttentionItem } from "@/lib/attention"
import type { totals } from "@/lib/portfolio"
import { fmtINR } from "@/lib/domain/rules"
import { Pill } from "@/components/shared/badges"
import { cn } from "@/lib/utils"

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

const TONE = { ok: "text-ok", warn: "text-warn", bad: "text-bad", brand: "text-brand" }
const BAR = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", brand: "bg-brand" }

/** One big number, one line, and an optional bar: readable in a second. */
function Tile({ icon: Icon, label, value, sub, tone, pct }: { icon: LucideIcon; label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: keyof typeof TONE; pct?: number }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><Icon className="size-4" aria-hidden /></span>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div className={cn("mt-4 text-3xl font-semibold tracking-tight tabular-nums", tone && TONE[tone])}>{value}</div>
      {sub && <div className="mt-1 text-sm text-muted-foreground">{sub}</div>}
      {pct !== undefined && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
          <div className={cn("h-full rounded-full", BAR[tone ?? "brand"])} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
    </div>
  )
}

/** The headline numbers, written for a 10-second read. */
export function KpiRow({ t, showMoney }: { t: Totals; showMoney?: boolean }) {
  const timePct = t.agreedHours > 0 ? Math.round((t.loggedHours / t.agreedHours) * 100) : undefined
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><Activity className="size-4" aria-hidden /></span>
          <span className="text-sm font-medium text-muted-foreground">Live projects</span>
        </div>
        <div className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{t.live}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-sm">
          <span className="text-ok">{t.health.on_track} on track</span>
          <span className="text-warn">{t.health.at_risk} at risk</span>
          <span className="text-bad">{t.health.delayed} delayed</span>
        </div>
        <HealthBar health={t.health} className="mt-4 h-1.5" />
      </div>
      <Tile icon={Stamp} label="Waiting on client" value={t.pendingApprovals} sub={t.overdueApprovals ? <span className="text-bad">{t.overdueApprovals} overdue</span> : "None overdue"} tone={t.overdueApprovals ? "bad" : undefined} />
      <Tile icon={Ban} label="Open blockers" value={t.openBlockers} sub={`${t.openChanges} open change request${t.openChanges === 1 ? "" : "s"}`} tone={t.openBlockers ? "warn" : undefined} />
      <Tile icon={Flag} label="Milestones accepted" value={`${t.accepted} of ${t.milestones}`} sub="Across all projects" pct={t.milestones ? (t.accepted / t.milestones) * 100 : 0} />
      {timePct !== undefined && (
        <Tile
          icon={Clock}
          label="Time used"
          value={`${timePct}%`}
          sub={`${Math.round(t.loggedHours / 8).toLocaleString("en-IN")} of ${Math.round(t.agreedHours / 8).toLocaleString("en-IN")} agreed days`}
          tone={timePct > 100 ? "bad" : timePct >= 85 ? "warn" : "ok"}
          pct={timePct}
        />
      )}
      {showMoney && <Tile icon={CircleDollarSign} label="Agreed value" value={fmtINR(t.agreedValue)} sub="From approved estimates" />}
    </div>
  )
}

/** One client organisation: click through to its projects. */
export function OrgCard({ org, t, href, projectNames }: { org: { name: string; code: string }; t: Totals; href: string; projectNames: string[] }) {
  const attention = t.overdueApprovals + t.openBlockers + t.stale
  return (
    <Link href={href} className="glass-card group flex flex-col rounded-2xl p-5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><Building2 className="size-5" aria-hidden /></span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{org.name}</h3>
            <p className="font-mono text-[11px] text-muted-foreground">{org.code} · {t.projects} project{t.projects === 1 ? "" : "s"}</p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition duration-200 group-hover:text-foreground group-focus-visible:text-foreground">
          <span className="translate-x-1 opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">View projects</span>
          <ArrowUpRight className="size-4" aria-hidden />
        </span>
      </div>
      <HealthBar health={t.health} className="mt-4" />
      <div className="mt-2 flex flex-wrap gap-x-3 text-xs">
        <span className="text-ok">{t.health.on_track} on track</span>
        <span className="text-warn">{t.health.at_risk} at risk</span>
        <span className="text-bad">{t.health.delayed} delayed</span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{projectNames.join(" · ")}</p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t pt-3">
        {attention > 0 ? <Pill tone="bad">{attention} need{attention === 1 ? "s" : ""} attention</Pill> : <Pill tone="ok">No exceptions</Pill>}
        {t.pendingApprovals > 0 && <Pill tone="brand">{t.pendingApprovals} awaiting client</Pill>}
        {t.agreedValue > 0 && <span className="ml-auto text-xs text-muted-foreground tabular-nums">{fmtINR(t.agreedValue)}</span>}
      </div>
    </Link>
  )
}

const ICON = { "Overdue approval": Stamp, "Commercial change": CircleDollarSign, "Long-standing blocker": Ban, "Stale status": Clock, "Paused project": PauseCircle }

export function AttentionList({ items, orgName, limit = 6 }: { items: AttentionItem[]; orgName?: (id: string) => string; limit?: number }) {
  if (items.length === 0) return <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No exceptions. Everything is moving.</p>
  return (
    <ul className="divide-y rounded-lg border">
      {items.slice(0, limit).map((i) => {
        const Icon = ICON[i.kind]
        return (
          <li key={i.id}>
            <Link href={i.href} className="flex items-start gap-3 p-3 transition hover:bg-muted/60">
              <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md", i.severity === "high" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn")}>
                <Icon className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm leading-snug font-medium">{i.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {i.kind} · {i.projectName}{orgName ? ` · ${orgName(i.clientOrgId)}` : ""}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
      {items.length > limit && <li className="p-3 text-xs text-muted-foreground">+{items.length - limit} more</li>}
    </ul>
  )
}
