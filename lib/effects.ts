import "server-only"
import { db, newId, nowIso } from "@/lib/store"
import type { User } from "@/lib/domain/types"
import { isClientKind } from "@/lib/domain/rules"

/** Append-only (REQ-AUD-01). There is deliberately no update or delete helper. */
export function audit(actorId: string, action: string, detail: string, projectId?: string, security = false) {
  db().audit.push({ id: newId("au"), at: nowIso(), actorId, action, detail, projectId, security })
}

export function hrefFor(user: User, projectId: string | undefined, path = "") {
  if (!projectId) return "/"
  return `${isClientKind(user.kind) ? "/portal/projects" : "/w/projects"}/${projectId}${path}`
}

/**
 * Tier 1 = immediate in-app + immediate email, cannot be muted.
 * Tier 2 = immediate in-app + queued for the daily digest (unless digest is off).
 * `canSee` gates every recipient so nobody is notified about items outside their audience (REQ-NTF-04).
 */
export function notify(opts: {
  userIds: string[]
  tier: 1 | 2
  title: string
  projectId?: string
  path?: string
  canSee?: (u: User) => boolean
  exclude?: string
}) {
  const d = db()
  const seen = new Set<string>()
  for (const id of opts.userIds) {
    if (seen.has(id) || id === opts.exclude) continue
    seen.add(id)
    const u = d.users.find((x) => x.id === id)
    if (!u || u.status !== "active") continue
    if (opts.canSee && !opts.canSee(u)) continue
    const href = hrefFor(u, opts.projectId, opts.path)
    d.notifications.push({ id: newId("n"), userId: u.id, tier: opts.tier, title: opts.title, href, at: nowIso(), read: false, projectId: opts.projectId })
    if (opts.tier === 2 && d.digestOptOut[u.id]) continue
    d.emails.push({
      id: newId("em"),
      to: u.email,
      userId: u.id,
      tier: opts.tier,
      subject: opts.title,
      link: `https://pulse.morphoverse.com${href}`,
      at: nowIso(),
      status: opts.tier === 1 ? "sent" : "queued_digest",
    })
  }
}
