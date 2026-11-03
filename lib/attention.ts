import "server-only"
import type { User } from "@/lib/domain/types"
import { isClient } from "@/lib/access/audience"
import { blockers, changeRequests, ctxFor, projectsFor, summary, userName } from "@/lib/data"
import { daysBetween, fmtDate, fmtINR, todayIso } from "@/lib/domain/rules"

export interface AttentionItem {
  id: string
  kind: "Overdue approval" | "Commercial change" | "Long-standing blocker" | "Stale status" | "Paused project"
  severity: "high" | "medium"
  title: string
  detail: string
  projectId: string
  projectName: string
  clientOrgId: string
  href: string
}

/**
 * Exception feed (REQ-EXE-04): overdue approvals, commercial changes, long-standing
 * blockers, stale statuses and paused projects across the viewer's own projects.
 * Built on the audience-filtered queries, so each viewer only sees what they may see.
 */
export function attentionFor(user: User): AttentionItem[] {
  const client = isClient(user)
  const out: AttentionItem[] = []
  for (const p of projectsFor(user)) {
    const ctx = ctxFor(user, p.id)!
    const s = summary(ctx)
    const root = client ? `/portal/projects/${p.id}` : `/w/projects/${p.id}`
    const at = (clientPath: string, staffPath: string) => `${root}${client ? clientPath : staffPath}`
    const base = { projectId: p.id, projectName: p.name, clientOrgId: p.clientOrgId }
    for (const a of s.overdueApprovals)
      out.push({ ...base, id: a.id, kind: "Overdue approval", severity: "high", title: a.title, detail: `Due ${fmtDate(a.due)} · awaiting ${a.approverIds.map(userName).join(", ")}`, href: at(`?approve=${a.id}`, "/decisions") })
    for (const c of changeRequests(ctx).filter((c) => !["implemented", "declined", "withdrawn"].includes(c.state) && (c.impact?.costDelta || c.category === "change scope")))
      out.push({ ...base, id: c.id, kind: "Commercial change", severity: "high", title: `CR-${c.number}: ${c.what}`, detail: c.impact?.costDelta ? `Cost impact ${fmtINR(c.impact.costDelta)} · ${c.state.replaceAll("_", " ")}` : `Scope change · ${c.state.replaceAll("_", " ")}`, href: at("/decisions", `/decisions?cr=${c.id}`) })
    for (const b of blockers(ctx).filter((b) => !b.resolvedAt && daysBetween(b.raisedAt, todayIso()) >= 7))
      out.push({ ...base, id: b.id, kind: "Long-standing blocker", severity: daysBetween(b.raisedAt, todayIso()) > 14 ? "high" : "medium", title: b.reason, detail: `Open ${daysBetween(b.raisedAt, todayIso())} days · ${userName(b.responsibleId)}`, href: at("/journey", "/plan") })
    if (s.stale && !["proposal", "setup", "closed", "archived", "cancelled"].includes(p.lifecycle))
      out.push({ ...base, id: `stale-${p.id}`, kind: "Stale status", severity: "medium", title: "Status not updated in over 14 days", detail: s.status ? `Last update ${fmtDate(s.status.at)}` : "No status yet", href: at("", "/overview") })
    if (p.lifecycle === "paused")
      out.push({ ...base, id: `paused-${p.id}`, kind: "Paused project", severity: "medium", title: `${p.name} is paused`, detail: p.pause?.reason ?? "", href: at("", "/overview") })
  }
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1))
}
