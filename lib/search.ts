import "server-only"
import type { User } from "@/lib/domain/types"
import { isClient, isProjectStaff } from "@/lib/access/audience"
import { actions, changeRequests, ctxFor, decisions, documents, milestones, projectsFor, publications, threads, userName } from "@/lib/data"

export interface SearchHit {
  id: string
  kind: "Project" | "Document" | "Publication" | "Team remarks" | "Decision" | "Milestone" | "Comment" | "Change request" | "Action"
  title: string
  snippet: string
  projectName: string
  href: string
}

export const MIN_QUERY = 2

/**
 * Audience-safe search (REQ-SRC-01). Every candidate comes from the same
 * audience-filtered queries the pages use, so restricted items never produce
 * a hit, a snippet or a count. Named items the viewer can't open are skipped
 * entirely (not even their title is matched).
 */
export function search(user: User, raw: string): SearchHit[] {
  const q = raw.trim().toLowerCase()
  if (q.length < MIN_QUERY) return []
  const terms = q.split(/\s+/)
  const matches = (...fields: (string | undefined)[]) => {
    const hay = fields.filter(Boolean).join(" \n ").toLowerCase()
    return terms.every((t) => hay.includes(t))
  }
  const snip = (text: string) => {
    const i = text.toLowerCase().indexOf(terms[0])
    if (i < 0) return text.slice(0, 140)
    const start = Math.max(0, i - 50)
    return `${start > 0 ? "…" : ""}${text.slice(start, start + 160)}${start + 160 < text.length ? "…" : ""}`
  }

  const hits: SearchHit[] = []
  for (const p of projectsFor(user)) {
    const ctx = ctxFor(user, p.id)!
    const staff = isProjectStaff(ctx)
    const base = isClient(user) ? `/portal/projects/${p.id}` : `/w/projects/${p.id}`
    const at = (staffPath: string, clientPath: string) => `${base}${staff ? staffPath : clientPath}`
    const push = (h: Omit<SearchHit, "projectName">) => hits.push({ ...h, projectName: p.name })

    if (matches(p.name, p.code, p.objectives, p.scope))
      push({ id: p.id, kind: "Project", title: p.name, snippet: snip(`${p.code} · ${p.objectives}`), href: at("/overview", "") })

    for (const m of milestones(ctx))
      if (matches(m.name, m.description, m.criteria))
        push({ id: m.id, kind: "Milestone", title: m.name, snippet: snip(m.criteria || m.description), href: at("/plan", "/journey") })

    for (const d of documents(ctx)) {
      if ("restricted" in d || d.retracted) continue
      const cur = d.versions.at(-1)!
      if (matches(d.title, cur.fileName, cur.changeNote))
        push({ id: d.id, kind: "Document", title: d.title, snippet: snip(`v${cur.n} — ${cur.changeNote}`), href: at("/publications", "/documents") })
    }

    for (const pub of publications(ctx)) {
      if (pub.retracted) continue
      if (matches(pub.title, pub.summary))
        push({ id: pub.id, kind: "Publication", title: pub.title, snippet: snip(pub.summary), href: at("/publications", "/documents") })
      // publications() already strips Team remarks for anyone who isn't project staff.
      if (staff && pub.teamRemarks && matches(pub.teamRemarks))
        push({ id: `${pub.id}-remarks`, kind: "Team remarks", title: pub.title, snippet: snip(pub.teamRemarks), href: at("/publications", "/documents") })
      if (pub.state !== "published") continue
      for (const t of threads(ctx, pub.id))
        for (const c of t.comments)
          if (matches(c.body))
            push({ id: c.id, kind: "Comment", title: `${userName(c.authorId)} on ${pub.title}${t.audience === "team" ? " (Team)" : ""}`, snippet: snip(c.body), href: at("/publications", "/documents") })
    }

    for (const d of decisions(ctx))
      if (matches(d.statement, d.context))
        push({ id: d.id, kind: "Decision", title: d.statement, snippet: d.context ?? "", href: at("/decisions", "/decisions") })

    for (const c of changeRequests(ctx))
      if (matches(c.what, c.why))
        push({ id: c.id, kind: "Change request", title: `CR-${c.number}: ${c.what}`, snippet: snip(c.why), href: at(`/decisions?cr=${c.id}`, "/decisions") })

    for (const a of actions(ctx))
      if (matches(a.description))
        push({ id: a.id, kind: "Action", title: a.description, snippet: `Owner ${userName(a.ownerId)}`, href: at("/plan", "") })
  }
  return hits.slice(0, 60)
}
