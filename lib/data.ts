import "server-only"
import { cookies } from "next/headers"
import { db } from "@/lib/store"
import type {
  ApprovalRequest,
  DocumentItem,
  Estimate,
  Project,
  Publication,
  User,
} from "@/lib/domain/types"
import {
  type AccessCtx,
  type ItemKind,
  canSeeAudience,
  canSeeCommercial,
  canViewInternalCost,
  hasShell,
  isClient,
  isExecOverseer,
  isProjectDirector,
  isProjectStaff,
  isRestrictedStub,
  isStaff,
} from "@/lib/access/audience"
import { estimateTotals, fmtDate, fmtINR, isOverdue, isStale, nextMilestone, progress } from "@/lib/domain/rules"

export const USER_COOKIE = "pp_user"
export const DEFAULT_USER = "u-tashi"

// ── Viewer ──────────────────────────────────────────────────────────────────
export async function getViewerId() {
  const c = await cookies()
  const id = c.get(USER_COOKIE)?.value
  // An ID that no longer exists (e.g. a renamed demo user) falls back to the default user.
  return id && db().users.some((u) => u.id === id) ? id : DEFAULT_USER
}

/** Returns the signed-in user, or null when the account is deactivated (session ended). */
export async function getViewer(): Promise<User | null> {
  const id = await getViewerId()
  const u = db().users.find((x) => x.id === id)
  return u && u.status === "active" ? u : null
}

export const userById = (id: string) => db().users.find((u) => u.id === id)
export const userName = (id: string) => userById(id)?.name ?? (id === "system" ? "System" : "Unknown user")
export const orgById = (id: string) => db().orgs.find((o) => o.id === id)

export function ctxFor(user: User, projectId: string): AccessCtx | null {
  const project = db().projects.find((p) => p.id === projectId)
  if (!project) return null
  const membership = db().memberships.find((m) => m.projectId === projectId && m.userId === user.id)
  return { user, project, membership }
}

/** Shell access or null — callers turn null into notFound() (no existence leak). */
export function projectCtx(user: User | null, projectId: string): AccessCtx | null {
  if (!user) return null
  const ctx = ctxFor(user, projectId)
  return ctx && hasShell(ctx) ? ctx : null
}

const see = (ctx: AccessCtx, kind: ItemKind) => (x: { audience: Parameters<typeof canSeeAudience>[1]; authorId: string }) =>
  canSeeAudience(ctx, x.audience, x.authorId, kind)

// ── Projects ────────────────────────────────────────────────────────────────
export function projectsFor(user: User): Project[] {
  return db().projects.filter((p) => {
    const ctx = ctxFor(user, p.id)
    return ctx ? hasShell(ctx) : false
  })
}

export function workstreams(projectId: string) {
  return db().workstreams.filter((w) => w.projectId === projectId)
}
export const wsName = (id: string) => db().workstreams.find((w) => w.id === id)?.name ?? "Workstream"
export const phases = (projectId: string) => db().phases.filter((p) => p.projectId === projectId).sort((a, b) => a.order - b.order)

export function members(projectId: string) {
  return db()
    .memberships.filter((m) => m.projectId === projectId)
    .map((m) => ({ membership: m, user: userById(m.userId)! }))
    .filter((x) => x.user)
}

// ── Audience-filtered collections ───────────────────────────────────────────
export const statuses = (ctx: AccessCtx) =>
  db().statuses.filter((s) => s.projectId === ctx.project.id && hasShell(ctx)).sort((a, b) => b.at.localeCompare(a.at))

export const milestones = (ctx: AccessCtx) =>
  db().milestones.filter((m) => m.projectId === ctx.project.id).filter(see(ctx, "milestone")).sort((a, b) => a.currentDate.localeCompare(b.currentDate))

export const blockers = (ctx: AccessCtx) => db().blockers.filter((b) => b.projectId === ctx.project.id).filter(see(ctx, "blocker"))

export const actions = (ctx: AccessCtx) => db().actions.filter((a) => a.projectId === ctx.project.id).filter(see(ctx, "action"))

export type DocView = DocumentItem | { restricted: true; id: string; title: string; kind: DocumentItem["kind"]; authorId: string; publishedAt?: string }

export function documents(ctx: AccessCtx): DocView[] {
  const out: DocView[] = []
  // Commercial files are shown only with their estimate (see estimateFiles).
  for (const d of db().documents.filter((x) => x.projectId === ctx.project.id && x.kind !== "commercial")) {
    if (canSeeAudience(ctx, d.audience, d.authorId, "document")) out.push(d)
    else if (isRestrictedStub(ctx, d.audience, d.authorId, "document"))
      out.push({ restricted: true, id: d.id, title: d.title, kind: d.kind, authorId: d.authorId, publishedAt: d.publishedAt })
  }
  return out
}

export function document(ctx: AccessCtx, id: string) {
  const d = db().documents.find((x) => x.id === id && x.projectId === ctx.project.id)
  return d && canSeeAudience(ctx, d.audience, d.authorId, "document") ? d : null
}

/** Publications with Team remarks stripped for anyone who is not project staff (REQ-PUB-06). */
export function publications(ctx: AccessCtx): Publication[] {
  return db()
    .publications.filter((p) => p.projectId === ctx.project.id)
    .filter(see(ctx, "publication"))
    .filter((p) => isStaff(ctx.user) || p.state === "published")
    .map((p) => (isProjectStaff(ctx) ? p : { ...p, teamRemarks: undefined }))
    .sort((a, b) => (b.meetingAt ?? b.publishedAt ?? b.createdAt).localeCompare(a.meetingAt ?? a.publishedAt ?? a.createdAt))
}

export function publication(ctx: AccessCtx, id: string) {
  return publications(ctx).find((p) => p.id === id) ?? null
}

/** Attachments are filtered by each file's own audience (T-14). */
export function visibleAttachments(ctx: AccessCtx, p: Publication) {
  return p.attachments
    .map((a) => ({ ...a, doc: db().documents.find((d) => d.id === a.documentId) }))
    .filter((a) => a.doc && canSeeAudience(ctx, a.doc.audience, a.doc.authorId, "document")) as { documentId: string; version: number; doc: DocumentItem }[]
}

export const decisions = (ctx: AccessCtx) =>
  db().decisions.filter((d) => d.projectId === ctx.project.id).filter(see(ctx, "decision")).sort((a, b) => b.date.localeCompare(a.date))

export const changeRequests = (ctx: AccessCtx) =>
  db()
    .changeRequests.filter((c) => c.projectId === ctx.project.id)
    .filter((c) => canSeeAudience(ctx, c.audience, c.authorId, "change_request") || c.authorId === ctx.user.id)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

/** Approvals follow the visibility of their subject. */
export function approvals(ctx: AccessCtx): ApprovalRequest[] {
  return db()
    .approvals.filter((a) => a.projectId === ctx.project.id)
    .filter((a) => {
      if (isProjectStaff(ctx)) return true
      if (a.approverIds.includes(ctx.user.id)) return hasShell(ctx)
      const s = a.subject
      if (s.kind === "estimate") return canSeeCommercial(ctx) && !!estimates(ctx).find((e) => e.id === s.id)
      if (s.kind === "milestone") return !!milestones(ctx).find((m) => m.id === s.id)
      if (s.kind === "change_request") return !!changeRequests(ctx).find((c) => c.id === s.id) && canSeeCommercial(ctx)
      if (s.kind === "final") return canSeeCommercial(ctx)
      return false
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Estimates: staff see all versions; clients see shared-or-later versions without internal costs. */
export function estimates(ctx: AccessCtx): Estimate[] {
  if (!canSeeCommercial(ctx)) return []
  const all = db().estimates.filter((e) => e.projectId === ctx.project.id).sort((a, b) => b.version - a.version)
  if (canViewInternalCost(ctx)) return all
  return all
    .filter((e) => !!e.sharedAt && e.state !== "withdrawn")
    .map((e) => ({
      ...e,
      internal: { costPerDay: 0, targetMarginPct: 0, notes: "" },
      lineItems: e.detailLevel === "line_items" ? e.lineItems : [],
    }))
}

export function clientTotal(e: Estimate) {
  const original = db().estimates.find((x) => x.id === e.id)!
  return estimateTotals(original).total
}

export function threads(ctx: AccessCtx, subjectId: string) {
  return db()
    .threads.filter((t) => t.projectId === ctx.project.id && t.subject.id === subjectId)
    .filter((t) => t.audience === "shared" || isProjectStaff(ctx))
}

export function audit(ctx: AccessCtx) {
  if (!isProjectStaff(ctx)) return []
  const director = ctx.membership?.role === "owner" || ctx.membership?.role === "director"
  return db()
    .audit.filter((a) => a.projectId === ctx.project.id)
    .filter((a) => !a.security || director)
    .sort((a, b) => b.at.localeCompare(a.at))
}

export function accessRequests(ctx: AccessCtx) {
  return db().accessRequests.filter((r) => r.projectId === ctx.project.id)
}

// ── Needs You (REQ-NTF-06, UX-02) ───────────────────────────────────────────
export interface NeedsItem {
  id: string
  kind: "approval" | "action" | "clarification" | "survey"
  title: string
  detail: string
  due?: string
  overdue?: boolean
  href: string
  cta: string
  projectId: string
  projectName: string
  tier?: "A" | "B"
  approval?: ApprovalView
}

export interface ApprovalView {
  id: string
  projectId: string
  projectName: string
  title: string
  tier: "A" | "B"
  due: string
  overdue: boolean
  rule: "all" | "any"
  state: ApprovalRequest["state"]
  approverNames: string[]
  unavailable: string[]
  details: { label: string; value: string }[]
  notice?: string
  canDecide: boolean
  myResponse?: string
  responses: { name: string; outcome: string; comment: string; at: string; method: string }[]
  external?: string
  withdrawnReason?: string
}

export function approvalView(ctx: AccessCtx, a: ApprovalRequest): ApprovalView {
  const d = db()
  const details: { label: string; value: string }[] = []
  let notice: string | undefined
  const s = a.subject
  if (s.kind === "estimate") {
    const e = d.estimates.find((x) => x.id === s.id)!
    const t = estimateTotals(e)
    details.push(
      { label: "Version", value: `v${e.version} (immutable)` },
      { label: "Total incl. tax", value: fmtINR(t.total) },
      { label: "Effort", value: `${e.effortDays} person-days` },
      { label: "Duration", value: `${e.durationWeeks} weeks` },
      { label: "Valid until", value: fmtDate(e.validUntil) },
      { label: "Supporting files", value: e.attachmentIds.length ? `${e.attachmentIds.length} file(s) — see Decisions & agreements` : "None" },
    )
    notice = "Record of agreement only; not a contract or payment authorization."
  }
  if (s.kind === "milestone") {
    const m = d.milestones.find((x) => x.id === s.id)!
    details.push({ label: "Milestone", value: m.name }, { label: "Acceptance criteria", value: m.criteria || "—" }, { label: "Current date", value: fmtDate(m.currentDate) })
    const doc = d.documents.find((x) => x.title.toLowerCase().includes(m.name.toLowerCase().split(" ")[0]) && x.projectId === m.projectId && x.kind === "deliverable" && canSeeAudience(ctx, x.audience, x.authorId))
    if (doc) details.push({ label: "Deliverable", value: `${doc.title} v${doc.versions.length}` })
  }
  if (s.kind === "change_request") {
    const c = d.changeRequests.find((x) => x.id === s.id)!
    details.push({ label: "Change", value: `CR-${c.number}: ${c.what}` })
    if (c.impact) {
      details.push(
        { label: "Cost impact", value: c.impact.costDelta ? `${c.impact.costDelta > 0 ? "+" : ""}${fmtINR(c.impact.costDelta)}` : "None" },
        { label: "Date impact", value: c.impact.dateShiftDays ? `${c.impact.dateShiftDays} days on ${c.impact.milestoneIds.length} milestone(s)` : "None" },
        { label: "Scope", value: c.impact.scope },
      )
    }
    if (a.tier === "A") notice = "Record of agreement only; not a contract or payment authorization."
  }
  if (s.kind === "final") {
    const p = d.projects.find((x) => x.id === s.projectId)!
    const pr = progress(d.milestones.filter((m) => m.projectId === p.id))
    const est = d.estimates.find((e) => e.projectId === p.id && e.state === "approved")
    details.push(
      { label: "Project", value: p.name },
      { label: "Milestones", value: `${pr.accepted} of ${pr.total} accepted` },
      { label: "Checklist", value: p.closure ? p.closure.items.map((i) => `${i.label}: ${i.state}`).join(" · ") : "—" },
    )
    if (est) details.push({ label: "Agreed cost", value: fmtINR(estimateTotals(est).total) })
    notice = "Final acceptance records agreement that the engagement is complete; not a contract or payment authorization."
  }
  if (s.kind === "document") {
    const doc = d.documents.find((x) => x.id === s.id)
    if (doc) details.push({ label: "Document", value: `${doc.title} v${s.version}` })
  }
  const mine = a.responses.find((r) => r.userId === ctx.user.id)
  return {
    id: a.id,
    projectId: a.projectId,
    projectName: ctx.project.name,
    title: a.title,
    tier: a.tier,
    due: a.due,
    overdue: isOverdue(a, ctx.project.lifecycle),
    rule: a.rule,
    state: a.state,
    approverNames: a.approverIds.map(userName),
    unavailable: (a.unavailableApproverIds ?? []).map(userName),
    details,
    notice,
    canDecide: a.state === "pending" && a.approverIds.includes(ctx.user.id) && !mine,
    myResponse: mine?.outcome,
    responses: a.responses.map((r) => ({ name: userName(r.userId), outcome: r.outcome, comment: r.comment, at: r.at, method: r.method })),
    external: a.external ? `${a.external.evidence} — recorded by ${userName(a.external.recordedBy)}` : undefined,
    withdrawnReason: a.withdrawnReason,
  }
}

export function needsYou(user: User, projectId?: string): NeedsItem[] {
  const out: NeedsItem[] = []
  const ps = projectsFor(user).filter((p) => !projectId || p.id === projectId)
  const base = isClient(user) ? "/portal/projects" : "/w/projects"
  for (const p of ps) {
    const ctx = ctxFor(user, p.id)!
    for (const a of approvals(ctx)) {
      if (a.state === "pending" && a.approverIds.includes(user.id) && !a.responses.some((r) => r.userId === user.id))
        out.push({
          id: a.id, kind: "approval", title: a.title, detail: a.tier === "A" ? "Approval · needs a one-time code" : "Approval",
          due: a.due, overdue: isOverdue(a, p.lifecycle), href: `${base}/${p.id}?approve=${a.id}`, cta: "Review & decide",
          projectId: p.id, projectName: p.name, tier: a.tier, approval: approvalView(ctx, a),
        })
    }
    for (const a of actions(ctx))
      if (a.state === "open" && a.ownerId === user.id)
        out.push({
          id: a.id, kind: "action", title: a.description, detail: a.source ? `From ${a.source.label}` : "Action",
          due: a.due, overdue: !!a.due && a.due < new Date().toISOString().slice(0, 10) && p.lifecycle !== "paused",
          href: `${base}/${p.id}?action=${a.id}`, cta: "Mark done", projectId: p.id, projectName: p.name,
        })
    for (const c of changeRequests(ctx))
      if (c.state === "needs_clarification" && c.authorId === user.id)
        out.push({
          id: c.id, kind: "clarification", title: `Clarify CR-${c.number}: ${c.what}`, detail: c.clarification?.question ?? "",
          href: `${base}/${p.id}/decisions?cr=${c.id}`, cta: "Answer", projectId: p.id, projectName: p.name,
        })
    const c = p.closure
    if (c && !c.survey && ctx.membership?.role === "client_lead")
      out.push({
        id: `survey-${p.id}`, kind: "survey", title: `How did ${p.name} go?`, detail: "Short closure feedback · about a minute",
        href: `${base}/${p.id}`, cta: "Give feedback", projectId: p.id, projectName: p.name,
      })
  }
  return out.sort((a, b) => Number(!!b.overdue) - Number(!!a.overdue) || (a.due ?? "9").localeCompare(b.due ?? "9"))
}

// ── Project summary (shared by staff overview, client home, exec portfolio) ──
export function summary(ctx: AccessCtx) {
  const ms = milestones(ctx)
  const st = statuses(ctx)[0]
  const pubs = publications(ctx).filter((p) => p.state === "published" && !p.retracted && !p.supersededById)
  const aps = approvals(ctx)
  const est = estimates(ctx).find((e) => e.state === "approved")
  return {
    project: ctx.project,
    status: st,
    stale: isStale(st),
    progress: progress(ms),
    next: nextMilestone(ms),
    latest: [...pubs].sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))[0],
    openBlockers: blockers(ctx).filter((b) => !b.resolvedAt),
    overdueApprovals: aps.filter((a) => isOverdue(a, ctx.project.lifecycle)),
    pendingApprovals: aps.filter((a) => a.state === "pending"),
    openChanges: changeRequests(ctx).filter((c) => !["implemented", "declined", "withdrawn"].includes(c.state)),
    approvedTotal: est ? clientTotal(est) : undefined,
    expectedEnd: ms.filter((m) => m.state !== "dropped").map((m) => m.currentDate).sort().at(-1),
    owner: userById(ctx.project.ownerId),
    ...people(ctx.project.id),
    isExec: isExecOverseer(ctx),
    time: timeTotals(ctx.project.id),
  }
}

/**
 * Who is responsible, for display on cards. Names and project roles only (REQ-ORG-03):
 * project members may see who else is on their own project — never emails or rights.
 */
function people(projectId: string) {
  const ms = members(projectId).filter((m) => m.user.status === "active")
  const lite = (u: User) => ({ id: u.id, name: u.name })
  return {
    clientLeads: ms.filter((m) => m.membership.role === "client_lead").map((m) => lite(m.user)),
    team: ms.filter((m) => m.membership.role === "team" || m.membership.role === "director").map((m) => lite(m.user)),
  }
}

const HOURS_PER_DAY = 8

/** Agreed effort (from the approved estimate) against hours logged. Totals only. */
function timeTotals(projectId: string) {
  const est = db().estimates.find((e) => e.projectId === projectId && e.state === "approved")
  const logged = db().timeEntries.filter((t) => t.projectId === projectId).reduce((s, t) => s + t.hours, 0)
  const agreed = est ? est.effortDays * HOURS_PER_DAY : undefined
  return { agreedHours: agreed, loggedHours: logged, usedPct: agreed ? Math.round((logged / agreed) * 100) : undefined }
}

/**
 * Time and remaining work for the "at a glance" card. Agreed effort comes from the
 * approved estimate. Clients and Executive Directors get totals only; the CEO sees
 * every entry, a team member only their own.
 */
export function timeView(ctx: AccessCtx) {
  // Effort (not price) is shown to everyone on the project, so read it unfiltered.
  const est = db().estimates.find((e) => e.projectId === ctx.project.id && e.state === "approved")
  const all = db().timeEntries.filter((t) => t.projectId === ctx.project.id)
  const logged = all.reduce((s, t) => s + t.hours, 0)
  const agreedHours = est ? est.effortDays * HOURS_PER_DAY : undefined
  const openMs = milestones(ctx).filter((m) => m.state !== "accepted" && m.state !== "dropped")
  const openActions = actions(ctx).filter((a) => a.state === "open")
  const nextDue = [
    ...openMs.map((m) => ({ title: m.name, due: m.currentDate })),
    ...openActions.filter((a) => a.due).map((a) => ({ title: a.description, due: a.due! })),
  ].sort((a, b) => a.due.localeCompare(b.due))[0]
  const staff = isProjectStaff(ctx)
  const seesAll = staff && isProjectDirector(ctx)
  const entries = !staff ? [] : all
    .filter((t) => seesAll || t.userId === ctx.user.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .map((t) => ({ ...t, name: userName(t.userId) }))
  return {
    hoursPerDay: HOURS_PER_DAY,
    agreedDays: est?.effortDays,
    agreedHours,
    loggedHours: logged,
    leftHours: agreedHours !== undefined ? agreedHours - logged : undefined,
    usedPct: agreedHours ? Math.round((logged / agreedHours) * 100) : undefined,
    milestonesLeft: openMs.length,
    actionsLeft: openActions.length,
    nextDue,
    canLog: staff,
    seesAll,
    entries,
    byPerson: !seesAll ? [] : [...new Set(all.map((t) => t.userId))]
      .map((userId) => {
        const mine = all.filter((t) => t.userId === userId)
        const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
        return { userId, name: userName(userId), total: mine.reduce((s, t) => s + t.hours, 0), lastWeek: mine.filter((t) => t.date > weekAgo).reduce((s, t) => s + t.hours, 0) }
      })
      .sort((a, b) => b.total - a.total),
  }
}

export function notificationsFor(userId: string) {
  return db().notifications.filter((n) => n.userId === userId).sort((a, b) => b.at.localeCompare(a.at))
}

/** Everyone who could possibly see a project item: members plus the client's Executive Directors. */
export function audiencePeople(projectId: string) {
  const p = db().projects.find((x) => x.id === projectId)!
  const execs = db().users.filter((u) => u.kind === "exec" && u.orgId === p.clientOrgId && u.status === "active")
  return [...members(projectId).filter((m) => m.user.status === "active"), ...execs.map((user) => ({ user, membership: undefined }))]
}

export function pickerData(ctx: AccessCtx) {
  return {
    project: ctx.project,
    people: audiencePeople(ctx.project.id),
    workstreams: workstreams(ctx.project.id).map((w) => ({ id: w.id, name: w.name })),
    authorId: ctx.user.id,
  }
}

export function threadViews(ctx: AccessCtx, subjectId: string) {
  return threads(ctx, subjectId).map((t) => ({
    id: t.id,
    audience: t.audience,
    purpose: t.purpose,
    resolved: t.resolved,
    comments: t.comments.map((c) => ({ id: c.id, author: userName(c.authorId), body: c.body, at: c.at, editedAt: c.editedAt, mine: c.authorId === ctx.user.id })),
  }))
}

/**
 * Supporting files of an estimate. Staff see them always; client users exactly
 * when they can see that estimate (shared, and the viewer may see commercials).
 */
export function estimateFiles(ctx: AccessCtx, estimateId: string) {
  const e = estimates(ctx).find((x) => x.id === estimateId)
  if (!e) return []
  return e.attachmentIds
    .map((id) => db().documents.find((d) => d.id === id && d.projectId === ctx.project.id))
    .filter((d): d is DocumentItem => !!d)
    .map((d) => ({ id: d.id, title: d.title, fileName: d.versions.at(-1)!.fileName, sizeKb: d.versions.at(-1)!.sizeKb, version: d.versions.length }))
}

/** Download check for a commercial file: visible wherever one of its estimates is. */
export function canDownloadCommercial(ctx: AccessCtx, documentId: string) {
  return estimates(ctx).some((e) => e.attachmentIds.includes(documentId))
}
