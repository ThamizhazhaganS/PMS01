import Link from "next/link"
import { ArrowUpRight, CircleAlert, Clock } from "lucide-react"
import type { summary } from "@/lib/data"
import { fmtDate, fmtINR, relDays } from "@/lib/domain/rules"
import { HealthBadge, LifecycleBadge, Pill } from "./badges"

type Summary = ReturnType<typeof summary>

/** One card per project: status statement, health, next milestone, needs-you count (UX-01). */
export function ProjectCard({ s, href, needs, showMoney, orgName }: { s: Summary; href: string; needs?: number; showMoney?: boolean; orgName?: string }) {
  return (
    <Link href={href} className="group flex flex-col rounded-xl border bg-card p-5 transition hover:border-foreground/20 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">
            {s.project.code}
            {orgName ? ` · ${orgName}` : ""}
          </div>
          <h3 className="mt-1 text-base leading-snug font-semibold">{s.project.name}</h3>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" aria-hidden />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <HealthBadge health={s.status?.health} />
        {s.project.lifecycle !== "active" && <LifecycleBadge lifecycle={s.project.lifecycle} />}
        {s.stale && (
          <Pill tone="warn">
            <Clock className="size-3" /> Status stale
          </Pill>
        )}
        {!!needs && (
          <Pill tone="brand">
            <CircleAlert className="size-3" /> {needs} need{needs === 1 ? "s" : ""} you
          </Pill>
        )}
      </div>
      {s.status && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{s.status.text}</p>}
      <dl className="mt-auto grid grid-cols-2 gap-3 border-t pt-4 text-sm">
        <div className="min-w-0">
          <dt className="eyebrow">Next milestone</dt>
          <dd className="mt-1 truncate font-medium">{s.next ? s.next.name : "—"}</dd>
          <dd className="text-xs text-muted-foreground tabular-nums">{s.next ? `${fmtDate(s.next.currentDate)} · ${relDays(s.next.currentDate)}` : ""}</dd>
        </div>
        <div>
          <dt className="eyebrow">Progress</dt>
          <dd className="mt-1 font-medium tabular-nums">
            {s.progress.accepted} of {s.progress.total}
          </dd>
          <dd className="text-xs text-muted-foreground">milestones accepted</dd>
        </div>
        {showMoney && s.approvedTotal !== undefined && (
          <div className="col-span-2">
            <dt className="eyebrow">Agreed cost</dt>
            <dd className="mt-1 font-medium tabular-nums">{fmtINR(s.approvedTotal)}</dd>
          </div>
        )}
      </dl>
    </Link>
  )
}
