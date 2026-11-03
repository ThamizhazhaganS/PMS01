import Link from "next/link"
import { ArrowUpRight, Ban, Building2, CircleDollarSign, Clock, PauseCircle, Stamp } from "lucide-react"
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

function Tile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "ok" | "warn" | "bad" | "brand" }) {
  const c = { ok: "text-ok", warn: "text-warn", bad: "text-bad", brand: "text-brand" }[tone ?? "brand"]
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="eyebrow">{label}</div>
      <div className={cn("mt-1.5 text-2xl font-semibold tracking-tight tabular-nums", tone && c)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

/** The headline numbers, written for a 10-second read. */
export function KpiRow({ t, showMoney }: { t: Totals; showMoney?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <div className="col-span-2 rounded-xl border bg-card p-4 md:col-span-1 xl:col-span-2">
        <div className="eyebrow">Live projects · health</div>
        <div className="mt-1.5 flex items-baseline gap-3">
          <span className="text-2xl font-semibold tabular-nums">{t.live}</span>
          <span className="flex flex-wrap gap-x-3 text-xs">
            <span className="text-ok">{t.health.on_track} on track</span>
            <span className="text-warn">{t.health.at_risk} at risk</span>
            <span className="text-bad">{t.health.delayed} delayed</span>
          </span>
        </div>
        <HealthBar health={t.health} className="mt-3" />
      </div>
      <Tile label="Waiting on client" value={t.pendingApprovals} sub={t.overdueApprovals ? <span className="text-bad">{t.overdueApprovals} overdue</span> : "none overdue"} tone={t.overdueApprovals ? "bad" : undefined} />
      <Tile label="Open blockers" value={t.openBlockers} sub={`${t.openChanges} open change request${t.openChanges === 1 ? "" : "s"}`} tone={t.openBlockers ? "warn" : undefined} />
      <Tile label="Milestones" value={`${t.accepted} / ${t.milestones}`} sub="accepted across projects" />
      {showMoney && <Tile label="Agreed value" value={<span className="text-xl">{fmtINR(t.agreedValue)}</span>} sub="from approved estimates" />}
    </div>
  )
}

/** One client organisation: click through to its projects. */
export function OrgCard({ org, t, href, projectNames }: { org: { name: string; code: string }; t: Totals; href: string; projectNames: string[] }) {
  const attention = t.overdueApprovals + t.openBlockers + t.stale
  return (
    <Link href={href} className="group flex flex-col rounded-xl border bg-card p-5 transition hover:border-foreground/25 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><Building2 className="size-5" aria-hidden /></span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{org.name}</h3>
            <p className="font-mono text-[11px] text-muted-foreground">{org.code} · {t.projects} project{t.projects === 1 ? "" : "s"}</p>
          </div>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" aria-hidden />
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
