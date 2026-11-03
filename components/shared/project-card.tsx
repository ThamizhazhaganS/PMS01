import Link from "next/link"
import { ArrowUpRight, CircleAlert, Clock } from "lucide-react"
import type { summary } from "@/lib/data"
import { ROLE_LABEL, fmtDate, fmtINR, relDays } from "@/lib/domain/rules"
import { HealthBadge, LifecycleBadge, Pill } from "./badges"
import { Initials } from "./ui"

type Summary = ReturnType<typeof summary>

/** One card per project: status statement, health, next milestone, needs-you count (UX-01). */
export function ProjectCard({ s, href, needs, showMoney, orgName, viewer = "staff" }: { s: Summary; href: string; needs?: number; showMoney?: boolean; orgName?: string; viewer?: "staff" | "client" }) {
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
      <People s={s} viewer={viewer} />
    </Link>
  )
}

/** Who is responsible, readable without opening the project. Names and roles only. */
function People({ s, viewer }: { s: Summary; viewer: "staff" | "client" }) {
  const team = s.team.filter((t) => t.id !== s.owner?.id)
  return (
    <dl className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 border-t pt-4 text-sm">
      <dt className="eyebrow">Responsible</dt>
      <dd className="flex min-w-0 items-center gap-2">
        {s.owner ? (
          <>
            <Initials name={s.owner.name} className="size-6 bg-brand text-[10px] text-brand-foreground" />
            <span className="truncate font-medium">{s.owner.name}</span>
            <span className="text-xs text-muted-foreground">· {ROLE_LABEL[s.owner.kind]}</span>
          </>
        ) : (
          "—"
        )}
      </dd>
      {viewer === "staff" && (
        <>
          <dt className="eyebrow">Client lead</dt>
          <dd className="truncate">{s.clientLeads.length ? s.clientLeads.map((c) => c.name).join(", ") : <span className="text-muted-foreground">Not yet assigned</span>}</dd>
        </>
      )}
      <dt className="eyebrow">{viewer === "client" ? "Morphoverse team" : "Team"}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        {team.length ? (
          <>
            <span className="flex -space-x-1.5" aria-hidden>
              {team.slice(0, 4).map((t) => (
                <span key={t.id} title={t.name}>
                  <Initials name={t.name} className="size-6 text-[10px] ring-2 ring-card" />
                </span>
              ))}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {team.slice(0, 2).map((t) => t.name).join(", ")}
              {team.length > 2 ? ` +${team.length - 2}` : ""}
            </span>
            <span className="sr-only">Team: {team.map((t) => t.name).join(", ")}</span>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">No team members yet</span>
        )}
      </dd>
    </dl>
  )
}
