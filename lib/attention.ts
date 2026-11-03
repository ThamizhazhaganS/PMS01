import "server-only"
import type { User } from "@/lib/domain/types"
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
  href: string
}

/** Exception feed for the Executive Director (REQ-EXE-04). Client-visible facts only. */
export function attentionFor(user: User): AttentionItem[] {
  const out: AttentionItem[] = []
  for (const p of projectsFor(user)) {
    const ctx = ctxFor(user, p.id)!
    const s = summary(ctx)
    const base = { projectId: p.id, projectName: p.name, href: `/portal/projects/${p.id}` }
    for (const a of s.overdueApprovals)
      out.push({ ...base, id: a.id, kind: "Overdue approval", severity: "high", title: a.title, detail: `Due ${fmtDate(a.due)} · awaiting ${a.approverIds.map(userName).join(", ")}`, href: `${base.href}?approve=${a.id}` })
    for (const c of changeRequests(ctx).filter((c) => !["implemented", "declined", "withdrawn"].includes(c.state) && (c.impact?.costDelta || c.category === "change scope")))
      out.push({ ...base, id: c.id, kind: "Commercial change", severity: "high", title: `CR-${c.number}: ${c.what}`, detail: c.impact?.costDelta ? `Cost impact ${fmtINR(c.impact.costDelta)} · ${c.state.replaceAll("_", " ")}` : `Scope change · ${c.state.replaceAll("_", " ")}`, href: `${base.href}/decisions` })
    for (const b of blockers(ctx).filter((b) => !b.resolvedAt && daysBetween(b.raisedAt, todayIso()) >= 7))
      out.push({ ...base, id: b.id, kind: "Long-standing blocker", severity: daysBetween(b.raisedAt, todayIso()) > 14 ? "high" : "medium", title: b.reason, detail: `Open ${daysBetween(b.raisedAt, todayIso())} days · ${userName(b.responsibleId)}`, href: `${base.href}/journey` })
    if (s.stale && p.lifecycle !== "proposal")
      out.push({ ...base, id: `stale-${p.id}`, kind: "Stale status", severity: "medium", title: "Status not updated in over 14 days", detail: s.status ? `Last update ${fmtDate(s.status.at)}` : "No status yet" })
    if (p.lifecycle === "paused")
      out.push({ ...base, id: `paused-${p.id}`, kind: "Paused project", severity: "medium", title: `${p.name} is paused`, detail: p.pause?.reason ?? "" })
  }
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1))
}
