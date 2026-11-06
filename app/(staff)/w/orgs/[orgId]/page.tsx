import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, Plus } from "lucide-react"
import { db } from "@/lib/store"
import { portfolioByOrg } from "@/lib/portfolio"
import { attentionMerged, weekStrip } from "@/lib/dashboard"
import { requireUser } from "@/lib/page-ctx"
import { LIFECYCLE_LABEL, ROLE_LABEL, fmtDate, fmtINR } from "@/lib/domain/rules"
import { Initials } from "@/components/shared/ui"
import { AttentionPanel, Headlines, WeekStrip } from "@/components/staff/ceo-dashboard"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const HEALTH = { on_track: { label: "On track", cls: "text-ok" }, at_risk: { label: "At risk", cls: "text-warn" }, delayed: { label: "Delayed", cls: "text-bad" } }
const RANK = { delayed: 0, at_risk: 1, on_track: 2 }
const PEOPLE_ORDER = { exec: 0, client_lead: 1, client_stakeholder: 2 } as Record<string, number>

/** One client organisation: the dashboard, zoomed in on this client. */
export default async function OrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const user = await requireUser(["director"])
  // Only organisations where the viewer has a project; anything else looks like it doesn't exist.
  const entry = portfolioByOrg(user).orgs.find((o) => o.org.id === orgId)
  if (!entry) notFound()
  const { org, rows, totals } = entry
  const short = org.name.split(" ")[0]
  const week = weekStrip(user, orgId)
  const attention = attentionMerged(user, orgId)
  // Projects needing help first, then by name.
  const projects = [...rows].sort((a, b) => (RANK[a.status?.health ?? "on_track"] - RANK[b.status?.health ?? "on_track"]) || a.project.name.localeCompare(b.project.name))
  const d = db()
  const people = d.users
    .filter((u) => u.orgId === orgId && u.status === "active")
    .sort((a, b) => (PEOPLE_ORDER[a.kind] ?? 9) - (PEOPLE_ORDER[b.kind] ?? 9))
  const keyPeople = people.filter((u) => u.kind !== "client_stakeholder")
  const stakeholders = people.length - keyPeople.length
  const projectsOf = (userId: string) => d.memberships.filter((m) => m.userId === userId && rows.some((r) => r.project.id === m.projectId)).length

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/w" className="hover:text-foreground">Dashboard</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-foreground">{org.name}</span>
      </nav>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="display text-3xl leading-tight sm:text-4xl">{org.name}</h1>
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{org.code} · client</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {totals.projects} project{totals.projects === 1 ? "" : "s"}
            {totals.health.delayed > 0 && <> · <span className="text-bad">{totals.health.delayed} delayed</span></>}
            {totals.health.at_risk > 0 && <> · <span className="text-warn">{totals.health.at_risk} at risk</span></>}
            {totals.agreedValue > 0 && <> · {fmtINR(totals.agreedValue)} agreed</>}
          </p>
        </div>
        <Link href={`/w/new?org=${org.id}`} className={buttonVariants()}>
          <Plus /> New project for {short}
        </Link>
      </div>

      <div className="space-y-5">
        <Headlines t={totals} waitingLabel={`Waiting on ${short}`} />
        <WeekStrip days={week.days} count={week.count} title={`This week at ${short}`} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="rounded-2xl border bg-card p-5" aria-labelledby="projects-h">
            <h2 id="projects-h" className="text-base font-semibold">Projects</h2>
            <div className="mt-3 overflow-x-auto">
              <div className="min-w-[36rem]">
                <div className="grid grid-cols-[minmax(0,2fr)_7rem_5rem_minmax(0,1.5fr)_1rem] gap-3 border-b px-2 pb-2 text-xs text-muted-foreground">
                  <span>Project</span>
                  <span>Health</span>
                  <span>Time</span>
                  <span>Next milestone</span>
                  <span />
                </div>
                <ul>
                  {projects.map((r) => {
                    const h = r.status?.health ? HEALTH[r.status.health] : undefined
                    const pct = r.time.usedPct
                    return (
                      <li key={r.project.id}>
                        <Link
                          href={`/w/projects/${r.project.id}/overview`}
                          className="group grid grid-cols-[minmax(0,2fr)_7rem_5rem_minmax(0,1.5fr)_1rem] items-center gap-3 rounded-lg border-b px-2 py-3 text-sm transition last:border-0 hover:bg-muted/60"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{r.project.name}</span>
                            <span className="block text-xs text-muted-foreground">{LIFECYCLE_LABEL[r.project.lifecycle]}</span>
                          </span>
                          <span className={cn("text-xs", h?.cls ?? "text-muted-foreground")}>● {h?.label ?? "No status"}</span>
                          <span className={cn("text-xs tabular-nums", pct !== undefined && pct > 100 ? "font-medium text-bad" : pct === undefined && "text-muted-foreground")}>{pct !== undefined ? `${pct}%` : "—"}</span>
                          <span className="min-w-0 truncate text-xs">{r.next ? `${r.next.name} · ${fmtDate(r.next.currentDate)}` : "—"}</span>
                          <ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </section>

          <div className="space-y-5">
            <AttentionPanel rows={attention} />
            <section className="rounded-2xl border bg-card p-5" aria-labelledby="people-h">
              <h2 id="people-h" className="text-base font-semibold">People at {short}</h2>
              {people.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No users yet. The Admin invites them.</p>
              ) : (
                <ul className="mt-3 grid gap-3">
                  {keyPeople.map((u) => (
                    <li key={u.id} className="flex items-center gap-2.5 text-sm">
                      <Initials name={u.name} className="size-8 text-[11px]" />
                      <span className="min-w-0">
                        <span className="block font-medium">{u.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {ROLE_LABEL[u.kind]}
                          {u.kind === "client_lead" && ` · ${projectsOf(u.id)} project${projectsOf(u.id) === 1 ? "" : "s"}`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {stakeholders > 0 && <p className="mt-3 text-xs text-muted-foreground">+{stakeholders} stakeholder{stakeholders === 1 ? "" : "s"}</p>}
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
