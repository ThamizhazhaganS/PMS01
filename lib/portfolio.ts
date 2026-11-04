import "server-only"
import type { User } from "@/lib/domain/types"
import { ctxFor, orgById, projectsFor, summary } from "@/lib/data"

type Summary = ReturnType<typeof summary>

const OPEN = ["setup", "proposal", "active", "paused", "closing"]

/** Roll-up numbers for a set of project summaries. Derived each time; never stored. */
export function totals(rows: Summary[]) {
  const live = rows.filter((r) => OPEN.includes(r.project.lifecycle))
  const health = { on_track: 0, at_risk: 0, delayed: 0, none: 0 }
  live.forEach((r) => (r.status ? health[r.status.health]++ : health.none++))
  return {
    projects: rows.length,
    live: live.length,
    health,
    pendingApprovals: live.reduce((s, r) => s + r.pendingApprovals.length, 0),
    overdueApprovals: live.reduce((s, r) => s + r.overdueApprovals.length, 0),
    openBlockers: live.reduce((s, r) => s + r.openBlockers.length, 0),
    openChanges: live.reduce((s, r) => s + r.openChanges.length, 0),
    stale: live.filter((r) => r.stale && r.project.lifecycle !== "proposal" && r.project.lifecycle !== "setup").length,
    accepted: rows.reduce((s, r) => s + r.progress.accepted, 0),
    milestones: rows.reduce((s, r) => s + r.progress.total, 0),
    agreedValue: rows.reduce((s, r) => s + (r.approvedTotal ?? 0), 0),
    agreedHours: live.reduce((s, r) => s + (r.time.agreedHours ?? 0), 0),
    loggedHours: live.reduce((s, r) => s + (r.time.agreedHours ? r.time.loggedHours : 0), 0),
  }
}

/** The viewer's projects grouped by client organisation (only orgs where they have a project). */
export function portfolioByOrg(user: User) {
  const rows = projectsFor(user).map((p) => summary(ctxFor(user, p.id)!))
  const byOrg = new Map<string, Summary[]>()
  for (const r of rows) byOrg.set(r.project.clientOrgId, [...(byOrg.get(r.project.clientOrgId) ?? []), r])
  const orgs = [...byOrg.entries()]
    .map(([orgId, list]) => ({ org: orgById(orgId)!, rows: list, totals: totals(list) }))
    .sort((a, b) => a.org.name.localeCompare(b.org.name))
  return { rows, orgs, totals: totals(rows) }
}
