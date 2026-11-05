import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { portfolioByOrg } from "@/lib/portfolio"
import { attentionMerged, weekStrip } from "@/lib/dashboard"
import { requireUser } from "@/lib/page-ctx"
import { LIFECYCLE_LABEL } from "@/lib/domain/rules"
import { Empty } from "@/components/shared/ui"
import { AttentionPanel, Headlines, WeekStrip } from "@/components/staff/ceo-dashboard"
import { CeoOrgExplorer } from "@/components/staff/ceo-org-explorer"
import { buttonVariants } from "@/components/ui/button"

const greeting = () => {
  const h = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }))
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

/** CEO home: the day's numbers, this week's milestones, then clients → projects. */
export default async function Dashboard() {
  const user = await requireUser(["director", "team"])
  // The dashboard is the CEO's view; Team Members land on their projects.
  if (user.kind !== "director") redirect("/w/projects")
  const { orgs, totals } = portfolioByOrg(user)
  const week = weekStrip(user)
  const attention = attentionMerged(user)
  const clients = orgs.length

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="display text-3xl leading-tight sm:text-4xl">
            {greeting()}, <em>{user.name.split(" ")[0]}</em>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {totals.live} live project{totals.live === 1 ? "" : "s"} across {clients} client{clients === 1 ? "" : "s"}
            {totals.health.delayed > 0 && <> · <span className="text-bad">{totals.health.delayed} delayed</span></>}
            {totals.health.at_risk > 0 && <> · <span className="text-warn">{totals.health.at_risk} at risk</span></>}
            {" · "}
            {totals.pendingApprovals} waiting on the client
          </p>
        </div>
        <Link href="/w/new" className={buttonVariants()}>
          <Plus /> New project
        </Link>
      </div>

      {orgs.length === 0 ? (
        <Empty title="No engagements yet" hint="Create the first project to see it here." />
      ) : (
        <div className="space-y-5">
          <Headlines t={totals} />
          <WeekStrip days={week.days} count={week.count} />
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <CeoOrgExplorer
              orgs={orgs.map(({ org, rows, totals: t }) => {
                const care = t.health.at_risk + t.health.delayed
                return {
                  id: org.id,
                  name: org.name,
                  summary: `${t.projects} project${t.projects === 1 ? "" : "s"} · ${care ? `${care} need${care === 1 ? "s" : ""} care` : "all on track"}`,
                  projects: rows.map((r) => ({
                    id: r.project.id,
                    name: r.project.name,
                    health: r.status?.health,
                    note:
                      r.project.lifecycle !== "active"
                        ? LIFECYCLE_LABEL[r.project.lifecycle]
                        : r.time.usedPct !== undefined
                          ? `${r.time.usedPct}% time used`
                          : "No estimate yet",
                    over: r.project.lifecycle === "active" && (r.time.usedPct ?? 0) > 100,
                    href: `/w/projects/${r.project.id}/overview`,
                  })),
                }
              })}
            />
            <AttentionPanel rows={attention} />
          </div>
        </div>
      )}
    </>
  )
}
