"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { db, newId, nowIso, resetDb } from "@/lib/store"
import { USER_COOKIE, ctxFor, getViewer, members, userName, wsName } from "@/lib/data"
import { audit, notify } from "@/lib/effects"
import type {
  ActionItem,
  ApprovalOutcome,
  Audience,
  BlockerType,
  ChangeCategory,
  ClosureKey,
  DateLinkKind,
  Health,
  ImpactReview,
  LineItem,
  Membership,
  Publication,
  Survey,
  User,
  UserKind,
} from "@/lib/domain/types"
import {
  type AccessCtx,
  audienceBreadth,
  audienceLabel,
  canManageAccess,
  canPublish,
  canSeeAudience,
  canSeeCommercial,
  canSubmitChange,
  hasShell,
  isOwner,
  isProjectDirector,
  isProjectStaff,
} from "@/lib/access/audience"
import { CLOSURE_ITEMS, DEFAULT_PHASES, DEV_OTP, MIN_REASON, fmtDate, isClientKind, todayIso } from "@/lib/domain/rules"

export type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string }
const ok = (message?: string): Result => ({ ok: true, message })
const fail = (error: string): Result => ({ ok: false, error })

class Refused extends Error {}

/** datetime-local values are entered in project time (IST). */
const istToIso = (v: string) => new Date(v.length === 16 ? `${v}:00+05:30` : v).toISOString()

async function requireCtx(projectId: string): Promise<AccessCtx> {
  const user = await getViewer()
  if (!user) throw new Refused("Your session has ended. Switch to an active user.")
  const ctx = ctxFor(user, projectId)
  // Same refusal whether the project exists or not (REQ-ACC-01).
  if (!ctx || !hasShell(ctx)) throw new Refused("Not found.")
  if (["closed", "cancelled", "archived"].includes(ctx.project.lifecycle))
    throw new Refused("This project is read-only.")
  return ctx
}

async function guard(fn: () => Promise<Result> | Result): Promise<Result> {
  try {
    const r = await fn()
    revalidatePath("/", "layout")
    return r
  } catch (e) {
    if (e instanceof Refused) return fail(e.message)
    throw e
  }
}

const viewerOf = (u: User, ctx: AccessCtx) => ctxFor(u, ctx.project.id)!
const seesItem = (ctx: AccessCtx, audience: Audience, authorId: string) => (u: User) =>
  canSeeAudience(viewerOf(u, ctx), audience, authorId)
const projectUserIds = (projectId: string) => members(projectId).map((m) => m.user.id)
const clientLeads = (projectId: string) => members(projectId).filter((m) => m.membership.role === "client_lead").map((m) => m.user.id)
const directors = (projectId: string) =>
  members(projectId).filter((m) => m.membership.role === "owner" || m.membership.role === "director").map((m) => m.user.id)

// ── Dev tools ───────────────────────────────────────────────────────────────
export async function switchUser(userId: string) {
  const c = await cookies()
  c.set(USER_COOKIE, userId, { path: "/", httpOnly: true, sameSite: "lax" })
  redirect("/")
}

export async function resetDemo() {
  resetDb()
  revalidatePath("/", "layout")
  redirect("/")
}

export async function markAllRead() {
  const u = await getViewer()
  if (!u) return
  db().notifications.filter((n) => n.userId === u.id).forEach((n) => (n.read = true))
  revalidatePath("/", "layout")
}

export async function sendDigestNow(): Promise<Result> {
  const q = db().emails.filter((e) => e.status === "queued_digest")
  const recipients = new Set(q.map((e) => e.userId))
  q.forEach((e) => (e.status = "sent_in_digest"))
  revalidatePath("/", "layout")
  return ok(`Daily digest sent to ${recipients.size} recipient(s) covering ${q.length} update(s).`)
}

export async function setDigest(enabled: boolean): Promise<Result> {
  const u = await getViewer()
  if (!u) return fail("No session")
  db().digestOptOut[u.id] = !enabled
  revalidatePath("/", "layout")
  return ok(enabled ? "Daily digest emails on. Urgent (Tier 1) emails are always sent." : "Daily digest emails off. Urgent (Tier 1) emails are still sent.")
}

// ── Overview: status statement ──────────────────────────────────────────────
export async function postStatus(projectId: string, input: { text: string; health: Health; explanation: string; nextSteps: string }) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectDirector(ctx)) return fail("Only the CEO can write the status statement.")
    if (input.text.trim().length < MIN_REASON) return fail("Write a status statement.")
    if (input.health !== "on_track" && input.explanation.trim().length < MIN_REASON)
      return fail("At Risk and Delayed need an explanation.")
    db().statuses.push({ id: newId("st"), projectId, text: input.text.trim(), health: input.health, explanation: input.explanation.trim() || undefined, nextSteps: input.nextSteps.trim(), authorId: ctx.user.id, at: nowIso() })
    audit(ctx.user.id, "Status updated", `Health set to ${input.health.replace("_", " ")}`, projectId)
    notify({ userIds: projectUserIds(projectId), tier: 2, title: `${ctx.project.name}: status updated`, projectId, exclude: ctx.user.id })
    return ok("Status statement published.")
  })
}

// ── Plan: milestones ────────────────────────────────────────────────────────
export async function changeMilestoneDate(projectId: string, milestoneId: string, to: string, reason: string, linkKind: DateLinkKind, linkId?: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectStaff(ctx)) return fail("Not allowed.")
    const m = db().milestones.find((x) => x.id === milestoneId && x.projectId === projectId)
    if (!m || !canSeeAudience(ctx, m.audience, m.authorId)) return fail("Not found.")
    if (!to) return fail("Choose a new date.")
    if (reason.trim().length < MIN_REASON) return fail("A written reason is required for every date change (T-22).")
    if ((linkKind === "blocker" || linkKind === "change_request") && !linkId) return fail("Link the blocker or change request.")
    if (to === m.currentDate) return fail("That is already the current date.")
    m.dateChanges.push({ from: m.currentDate, to, reason: reason.trim(), linkKind, linkId, at: nowIso(), by: ctx.user.id })
    const from = m.currentDate
    m.currentDate = to
    audit(ctx.user.id, "Date changed", `${m.name}: ${fmtDate(from)} → ${fmtDate(to)} (${linkKind.replace("_", " ")}). Baseline unchanged.`, projectId)
    notify({ userIds: projectUserIds(projectId), tier: 1, title: `Date changed: ${m.name} now ${fmtDate(to)}`, projectId, path: "/journey", canSee: seesItem(ctx, m.audience, m.authorId), exclude: ctx.user.id })
    return ok("Current date updated. Baseline preserved.")
  })
}

export async function milestoneTransition(projectId: string, milestoneId: string, to: "in_progress" | "ready_for_review" | "accepted", approverIds: string[] = []) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectStaff(ctx)) return fail("Not allowed.")
    const d = db()
    const m = d.milestones.find((x) => x.id === milestoneId && x.projectId === projectId)
    if (!m || !canSeeAudience(ctx, m.audience, m.authorId)) return fail("Not found.")
    if (to === "in_progress") {
      if (m.state !== "planned") return fail("Only planned milestones can start.")
      m.state = "in_progress"
      audit(ctx.user.id, "Milestone started", m.name, projectId)
      return ok("Milestone in progress.")
    }
    if (to === "ready_for_review") {
      if (!["in_progress", "changes_requested"].includes(m.state)) return fail("Milestone must be in progress.")
      if (m.acceptance === "client") {
        if (!canPublish(ctx)) return fail("You need the publish right to request a client approval.")
        if (!m.criteria.trim()) return fail("Acceptance criteria are required before review.")
        const valid = approverIds.filter((id) => {
          const mem = d.memberships.find((x) => x.projectId === projectId && x.userId === id)
          const u = d.users.find((x) => x.id === id)
          return u && mem && (mem.role === "client_lead" || mem.role === "client_stakeholder") && canSeeAudience(viewerOf(u, ctx), m.audience, m.authorId)
        })
        if (valid.length === 0) return fail("Designate at least one client approver who can see this milestone.")
        d.approvals.filter((a) => a.subject.kind === "milestone" && a.subject.id === m.id && a.state === "pending").forEach((a) => (a.state = "superseded"))
        const ap = { id: newId("ap"), projectId, title: `${m.name} (milestone)`, subject: { kind: "milestone" as const, id: m.id }, tier: "B" as const, approverIds: valid, rule: "any" as const, due: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10), state: "pending" as const, responses: [], requestedBy: ctx.user.id, createdAt: nowIso() }
        d.approvals.push(ap)
        notify({ userIds: valid, tier: 1, title: `Approval requested: ${m.name}`, projectId, path: `?approve=${ap.id}` })
        audit(ctx.user.id, "Approval requested", `${m.name} → ${valid.map(userName).join(", ")} (Tier B)`, projectId)
      }
      m.state = "ready_for_review"
      return ok(m.acceptance === "client" ? "Marked ready for review — approval requested." : "Marked ready for review.")
    }
    // accepted
    if (m.acceptance === "client") return fail("Client-acceptance milestones can only be accepted by the designated client approver (T-23).")
    if (!isProjectDirector(ctx)) return fail("Only the CEO accepts internal milestones.")
    if (m.state !== "ready_for_review") return fail("Mark it ready for review first.")
    m.state = "accepted"
    m.acceptedAt = nowIso()
    audit(ctx.user.id, "Milestone accepted", `${m.name} (internal acceptance)`, projectId)
    return ok("Internal milestone accepted.")
  })
}

export async function addBlocker(projectId: string, input: { reason: string; type: BlockerType; responsibleId: string; expectedResolution: string; milestoneIds: string[] }) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectStaff(ctx)) return fail("Not allowed.")
    if (input.reason.trim().length < 5) return fail("Describe the blocker.")
    if (!input.expectedResolution) return fail("Expected resolution date is required.")
    const ms = db().milestones.filter((m) => input.milestoneIds.includes(m.id))
    // Blocker inherits the narrowest audience of its linked milestones (or Client-wide).
    const wsAud = ms.find((m) => m.audience.kind === "workstream")?.audience
    const audience: Audience = wsAud ?? { kind: "client" }
    const b = { id: newId("b"), projectId, reason: input.reason.trim(), type: input.type, responsibleId: input.responsibleId, raisedAt: nowIso(), expectedResolution: input.expectedResolution, milestoneIds: input.milestoneIds, audience, authorId: ctx.user.id }
    db().blockers.push(b)
    audit(ctx.user.id, "Blocker raised", `${b.reason} → ${ms.map((m) => m.name).join(", ") || "no milestones"}`, projectId)
    notify({ userIds: [input.responsibleId], tier: 1, title: `Blocker assigned to you: ${b.reason}`, projectId, path: "/journey", canSee: seesItem(ctx, audience, ctx.user.id) })
    return ok("Blocker raised. No dates moved automatically.")
  })
}

export async function resolveBlocker(projectId: string, id: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectStaff(ctx)) return fail("Not allowed.")
    const b = db().blockers.find((x) => x.id === id && x.projectId === projectId)
    if (!b) return fail("Not found.")
    b.resolvedAt = nowIso()
    audit(ctx.user.id, "Blocker resolved", b.reason, projectId)
    return ok("Blocker resolved.")
  })
}

export async function addAction(projectId: string, input: { description: string; ownerId: string; due?: string; audience: Audience }) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectStaff(ctx)) return fail("Not allowed.")
    if (input.description.trim().length < 3) return fail("Describe the action.")
    const owner = db().users.find((u) => u.id === input.ownerId)
    if (!owner || !canSeeAudience(viewerOf(owner, ctx), input.audience, ctx.user.id)) return fail("The owner cannot see an action with that audience.")
    const a: ActionItem = { id: newId("a"), projectId, description: input.description.trim(), ownerId: input.ownerId, due: input.due || undefined, source: { kind: "manual", label: "Added in Plan" }, state: "open", audience: input.audience, authorId: ctx.user.id, createdAt: nowIso() }
    db().actions.push(a)
    audit(ctx.user.id, "Action assigned", `${a.description} → ${owner.name}`, projectId)
    notify({ userIds: [owner.id], tier: 1, title: `Action assigned: ${a.description}`, projectId, exclude: ctx.user.id })
    return ok("Action assigned.")
  })
}

export async function setActionState(projectId: string, id: string, state: "done" | "cancelled" | "open") {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    const a = db().actions.find((x) => x.id === id && x.projectId === projectId)
    if (!a || !canSeeAudience(ctx, a.audience, a.authorId)) return fail("Not found.")
    if (a.ownerId !== ctx.user.id && !isProjectStaff(ctx)) return fail("Only the owner can update this action.")
    if (a.state === state) return ok()
    a.state = state
    audit(ctx.user.id, "Action updated", `${a.description} → ${state}`, projectId)
    if (a.ownerId === ctx.user.id && state === "done")
      notify({ userIds: [a.authorId], tier: 2, title: `${ctx.user.name} completed: ${a.description}`, projectId })
    return ok(state === "done" ? "Marked done." : "Updated.")
  })
}

// ── Approvals ───────────────────────────────────────────────────────────────
export async function decideApproval(projectId: string, approvalId: string, outcome: ApprovalOutcome, comment: string, otp?: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    const d = db()
    const ap = d.approvals.find((a) => a.id === approvalId && a.projectId === projectId)
    if (!ap) return fail("Not found.")
    if (!ap.approverIds.includes(ctx.user.id)) return fail("You are not a designated approver on this request (T-19).")
    const prior = ap.responses.find((r) => r.userId === ctx.user.id)
    if (prior) return ok("Your decision was already recorded.") // idempotent (REQ-APR-07)
    if (ap.state !== "pending") return fail(`This request is ${ap.state.replace("_", " ")}.`)
    if (outcome !== "approve" && comment.trim().length < 3) return fail("A comment is required for Request changes and Decline.")
    if (ap.tier === "A" && otp !== DEV_OTP) return fail("Fresh verification failed. Enter the one-time code (dev: 123456).")
    ap.responses.push({ userId: ctx.user.id, outcome, comment: comment.trim(), at: nowIso(), method: ap.tier === "A" ? "Fresh sign-in + OTP" : "Secure one-click link" })

    let resolved = false
    if (outcome === "approve") {
      const approvedBy = new Set(ap.responses.filter((r) => r.outcome === "approve").map((r) => r.userId))
      resolved = ap.rule === "any" || ap.approverIds.every((id) => approvedBy.has(id))
      if (resolved) ap.state = "approved"
    } else {
      ap.state = outcome === "changes" ? "changes_requested" : "declined"
      resolved = true
    }
    const label = { approve: "approved", changes: "requested changes on", decline: "declined" }[outcome]
    audit(ctx.user.id, "Approval decided", `${ctx.user.name} ${label} "${ap.title}" (${ap.tier === "A" ? "Fresh sign-in + OTP" : "one-click link"})`, projectId)
    if (resolved) applyApprovalOutcome(ctx, ap.id)
    notify({ userIds: [ap.requestedBy, ...directors(projectId)], tier: 1, title: `${ctx.user.name} ${label} ${ap.title}`, projectId, path: "/decisions" })
    return ok(outcome === "approve" ? "Approved — recorded against this exact version." : "Your response has been recorded.")
  })
}

function applyApprovalOutcome(ctx: AccessCtx, approvalId: string) {
  const d = db()
  const ap = d.approvals.find((a) => a.id === approvalId)!
  const s = ap.subject
  const project = d.projects.find((p) => p.id === ap.projectId)!
  if (s.kind === "milestone") {
    const m = d.milestones.find((x) => x.id === s.id)!
    if (ap.state === "approved") {
      m.state = "accepted"
      m.acceptedAt = nowIso()
    } else m.state = "changes_requested"
  }
  if (s.kind === "estimate") {
    const e = d.estimates.find((x) => x.id === s.id)!
    if (ap.state === "approved") {
      d.estimates.filter((x) => x.projectId === e.projectId && x.state === "approved").forEach((x) => (x.state = "superseded"))
      e.state = "approved"
      e.approvedAt = nowIso()
      if (project.lifecycle === "proposal") {
        project.lifecycle = "active"
        let frozen = 0
        d.milestones.filter((m) => m.projectId === project.id && !m.baselineDate).forEach((m) => {
          m.baselineDate = m.currentDate
          frozen++
        })
        audit("system", "Lifecycle changed", `Proposal → Active. Baseline dates frozen for ${frozen} milestones`, project.id)
        notify({ userIds: projectUserIds(project.id), tier: 1, title: `${project.name} is now Active — estimate v${e.version} approved`, projectId: project.id })
      }
      d.decisions.push({ id: newId("dec"), projectId: project.id, statement: `Estimate v${e.version} approved`, context: ap.title, partyIds: ap.responses.map((r) => r.userId), date: todayIso(), state: "active", audience: { kind: "client" }, authorId: ctx.user.id })
    } else if (ap.state === "declined") e.state = "declined"
  }
  if (s.kind === "final")
    audit("system", "Final acceptance", `Final acceptance ${ap.state.replace("_", " ")}${ap.state === "approved" ? " — Owner can finalise closure once the checklist is complete" : " — project stays in Closing"}`, project.id)
  if (s.kind === "change_request") {
    const c = d.changeRequests.find((x) => x.id === s.id)!
    if (ap.state === "approved") c.state = "approved"
    else {
      c.state = "declined"
      c.declineReason = ap.responses.at(-1)?.comment
      reactivateDecision(c.linkedDecisionId)
    }
  }
}

export async function withdrawApproval(projectId: string, id: string, reason: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!canPublish(ctx)) return fail("Not allowed.")
    const ap = db().approvals.find((a) => a.id === id && a.projectId === projectId)
    if (!ap || ap.state !== "pending") return fail("Only pending requests can be withdrawn.")
    if (reason.trim().length < MIN_REASON) return fail("A reason is required.")
    ap.state = "withdrawn"
    ap.withdrawnReason = reason.trim()
    audit(ctx.user.id, "Approval withdrawn", `${ap.title}: ${reason}`, projectId)
    notify({ userIds: ap.approverIds, tier: 1, title: `Approval withdrawn: ${ap.title}`, projectId })
    return ok("Request withdrawn.")
  })
}

export async function recordExternalApproval(projectId: string, id: string, evidence: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isOwner(ctx)) return fail("Only the project Owner can record an external approval.")
    const ap = db().approvals.find((a) => a.id === id && a.projectId === projectId)
    if (!ap || ap.state !== "pending") return fail("Only pending requests.")
    if (evidence.trim().length < MIN_REASON) return fail("Describe the evidence (e.g. email from approver, date).")
    ap.external = { evidence: evidence.trim(), recordedBy: ctx.user.id }
    ap.responses.push({ userId: ap.approverIds[0], outcome: "approve", comment: "Externally received", at: nowIso(), method: `Externally received — recorded by ${ctx.user.name}` })
    ap.state = "approved"
    applyApprovalOutcome(ctx, ap.id)
    audit(ctx.user.id, "External approval recorded", `${ap.title}: ${evidence}`, projectId)
    return ok("Recorded as externally received.")
  })
}

// ── Documents & publications ───────────────────────────────────────────────
export async function uploadDocument(projectId: string, input: { title: string; fileName: string; kind: "deliverable" | "working" | "reference" }) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectStaff(ctx)) return fail("Not allowed.")
    if (!input.title.trim() || !input.fileName.trim()) return fail("Title and file are required.")
    if (/\.(exe|bat|cmd|js|scr)$/i.test(input.fileName)) return fail("File type not allowed (rejected by validation).")
    if (/eicar/i.test(input.fileName)) return fail("Malware scan failed — file quarantined (NFR-06).")
    const doc = { id: newId("doc"), projectId, title: input.title.trim(), kind: input.kind, audience: { kind: "draft" } as Audience, authorId: ctx.user.id, versions: [{ n: 1, fileName: input.fileName.trim(), sizeKb: 200 + Math.round(Math.random() * 3000), changeNote: "Initial upload.", uploadedAt: nowIso(), uploadedBy: ctx.user.id }] }
    db().documents.push(doc)
    audit(ctx.user.id, "Uploaded", `${doc.title} (Draft, scan passed)`, projectId)
    return ok("Uploaded as a private Draft. Scan passed.")
  })
}

export async function newDocumentVersion(projectId: string, docId: string, fileName: string, changeNote: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectStaff(ctx)) return fail("Not allowed.")
    const doc = db().documents.find((x) => x.id === docId && x.projectId === projectId)
    if (!doc || !canSeeAudience(ctx, doc.audience, doc.authorId)) return fail("Not found.")
    if (doc.retracted) return fail("Retracted documents cannot get new versions.")
    if (!fileName.trim()) return fail("Choose a file.")
    if (changeNote.trim().length < 5) return fail("A change note is required (REQ-DOC-07).")
    if (doc.audience.kind !== "draft" && doc.audience.kind !== "team" && !canPublish(ctx)) return fail("You need the publish right to version a published document.")
    const n = doc.versions.length + 1
    doc.versions.push({ n, fileName: fileName.trim(), sizeKb: 200 + Math.round(Math.random() * 3000), changeNote: changeNote.trim(), uploadedAt: nowIso(), uploadedBy: ctx.user.id })
    // Pending approvals bound to an older version become Superseded (REQ-APR-05).
    db().approvals.filter((a) => a.subject.kind === "document" && a.subject.id === doc.id && a.state === "pending").forEach((a) => (a.state = "superseded"))
    audit(ctx.user.id, "New version", `${doc.title} v${n}: ${changeNote}`, projectId)
    if (doc.audience.kind !== "draft")
      notify({ userIds: projectUserIds(projectId), tier: 2, title: `New version: ${doc.title} v${n}`, projectId, path: "/documents", canSee: seesItem(ctx, doc.audience, doc.authorId), exclude: ctx.user.id })
    return ok(`Version ${n} added. Earlier versions are retained.`)
  })
}

export async function setDocumentAudience(projectId: string, docId: string, audience: Audience, confirmed: boolean) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    const doc = db().documents.find((x) => x.id === docId && x.projectId === projectId)
    if (!doc || !canSeeAudience(ctx, doc.audience, doc.authorId)) return fail("Not found.")
    const widening = audienceBreadth(audience) > audienceBreadth(doc.audience)
    const toClients = audience.kind !== "draft" && audience.kind !== "team"
    if (toClients && !canPublish(ctx)) return fail("You need the publish right to share with clients.")
    if (!isProjectStaff(ctx)) return fail("Not allowed.")
    if (widening && !confirmed) return fail("Widening an audience must be confirmed.")
    const from = audienceLabel(doc.audience, wsName)
    doc.audience = audience
    if (toClients && !doc.publishedAt) doc.publishedAt = nowIso()
    audit(ctx.user.id, widening ? "Published" : "Audience narrowed", `${doc.title}: ${from} → ${audienceLabel(audience, wsName)}`, projectId)
    if (widening)
      notify({ userIds: projectUserIds(projectId), tier: 2, title: `Shared with you: ${doc.title}`, projectId, path: "/documents", canSee: seesItem(ctx, audience, doc.authorId), exclude: ctx.user.id })
    return ok(widening ? "Published." : "Audience updated.")
  })
}

export async function retractDocument(projectId: string, docId: string, reason: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectDirector(ctx)) return fail("Only the CEO can retract.")
    const doc = db().documents.find((x) => x.id === docId && x.projectId === projectId)
    if (!doc) return fail("Not found.")
    if (reason.trim().length < MIN_REASON) return fail("A reason is required.")
    doc.retracted = { reason: reason.trim(), at: nowIso(), by: ctx.user.id }
    audit(ctx.user.id, "Retracted", `${doc.title}: ${reason}`, projectId)
    return ok("Retracted. A notice remains; downloads are disabled.")
  })
}

export interface PublicationInput {
  kind: Publication["kind"]
  title: string
  meetingAt?: string
  summary: string
  attendeeIds: string[]
  decisions: string[]
  actions: { description: string; ownerId: string; due?: string }[]
  teamRemarks: string
  attachments: { documentId: string; audience: Audience | null }[]
  newFiles: { title: string; fileName: string; audience: Audience | null }[]
  audience: Audience | null
  actionRequired: boolean
}

export async function savePublication(projectId: string, input: PublicationInput, publish: boolean, confirmed: boolean) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectStaff(ctx)) return fail("Not allowed.")
    const d = db()
    if (input.title.trim().length < 3) return fail("Title is required.")
    if (input.kind === "meeting" && !input.meetingAt) return fail("Meeting date and time are required.")
    if (publish) {
      if (!canPublish(ctx)) return fail("You don't have the publish right. Save as Draft and ask the CEO to publish.")
      if (!input.audience || input.audience.kind === "draft") return fail("Choose an audience — there is no default.")
      if (!confirmed) return fail("Confirm the recipients before publishing.")
    }
    const audience: Audience = publish ? input.audience! : { kind: "draft" }
    const pubId = newId("pub")
    const at = nowIso()

    // Files: each one is published only with its own confirmed audience (REQ-PUB-07).
    const attachments: Publication["attachments"] = []
    for (const nf of input.newFiles.filter((f) => f.fileName.trim())) {
      if (/eicar/i.test(nf.fileName)) return fail(`Malware scan failed for ${nf.fileName} — quarantined.`)
      const doc = { id: newId("doc"), projectId, title: nf.title.trim() || nf.fileName, kind: "reference" as const, audience: (publish && nf.audience) || ({ kind: "draft" } as Audience), authorId: ctx.user.id, publishedAt: publish && nf.audience ? at : undefined, versions: [{ n: 1, fileName: nf.fileName.trim(), sizeKb: 300 + Math.round(Math.random() * 2000), changeNote: `Attached to ${input.title}`, uploadedAt: at, uploadedBy: ctx.user.id }] }
      d.documents.push(doc)
      attachments.push({ documentId: doc.id, version: 1 })
    }
    for (const a of input.attachments) {
      const doc = d.documents.find((x) => x.id === a.documentId && x.projectId === projectId)
      if (!doc || !canSeeAudience(ctx, doc.audience, doc.authorId)) continue
      if (publish && a.audience && audienceBreadth(a.audience) > audienceBreadth(doc.audience)) {
        doc.audience = a.audience
        doc.publishedAt ??= at
        audit(ctx.user.id, "Published", `${doc.title} → ${audienceLabel(a.audience, wsName)} (attachment)`, projectId)
      }
      attachments.push({ documentId: doc.id, version: doc.versions.length })
    }

    const decisionIds = input.decisions.filter((s) => s.trim()).map((statement) => {
      const id = newId("dec")
      d.decisions.push({ id, projectId, statement: statement.trim(), context: input.title, partyIds: input.attendeeIds, date: input.meetingAt ? input.meetingAt.slice(0, 10) : todayIso(), sourcePublicationId: pubId, state: "active", audience, authorId: ctx.user.id })
      return id
    })
    const actionIds: string[] = []
    for (const a of input.actions.filter((x) => x.description.trim())) {
      const id = newId("a")
      d.actions.push({ id, projectId, description: a.description.trim(), ownerId: a.ownerId, due: a.due || undefined, source: { kind: "publication", id: pubId, label: input.title }, state: "open", audience, authorId: ctx.user.id, createdAt: at })
      actionIds.push(id)
    }

    const pub: Publication = {
      id: pubId, projectId, kind: input.kind, title: input.title.trim(), meetingAt: input.meetingAt ? istToIso(input.meetingAt) : undefined,
      publishedAt: publish ? at : undefined, createdAt: at, summary: input.summary.trim(), attendeeIds: input.attendeeIds, decisionIds, actionIds,
      attachments, teamRemarks: input.teamRemarks.trim() || undefined, actionRequired: input.actionRequired, state: publish ? "published" : "draft", version: 1, audience, authorId: ctx.user.id,
    }
    d.publications.push(pub)
    audit(ctx.user.id, publish ? "Published" : "Draft saved", `${pub.kind === "meeting" ? "Meeting record" : "Publication"} '${pub.title}' → ${audienceLabel(audience, wsName)}`, projectId)
    if (publish) {
      notify({ userIds: projectUserIds(projectId), tier: input.actionRequired ? 1 : 2, title: `${input.actionRequired ? "Action required: " : "New: "}${pub.title}`, projectId, path: "/documents", canSee: seesItem(ctx, audience, ctx.user.id), exclude: ctx.user.id })
      for (const a of input.actions.filter((x) => x.description.trim()))
        notify({ userIds: [a.ownerId], tier: 1, title: `Action assigned: ${a.description}`, projectId, canSee: seesItem(ctx, audience, ctx.user.id) })
    }
    return ok(publish ? "Published. Decisions and actions added to the registers." : "Saved as a private Draft.")
  })
}

export async function publishDraftPublication(projectId: string, pubId: string, audience: Audience, confirmed: boolean) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!canPublish(ctx)) return fail("You need the publish right.")
    const d = db()
    const p = d.publications.find((x) => x.id === pubId && x.projectId === projectId)
    if (!p || p.state !== "draft" || !canSeeAudience(ctx, p.audience, p.authorId) && !isProjectDirector(ctx)) return fail("Not found.")
    if (audience.kind === "draft") return fail("Choose an audience.")
    if (!confirmed) return fail("Confirm the recipients before publishing.")
    p.state = "published"
    p.publishedAt = nowIso()
    p.audience = audience
    d.decisions.filter((x) => p.decisionIds.includes(x.id)).forEach((x) => (x.audience = audience))
    d.actions.filter((x) => p.actionIds.includes(x.id)).forEach((x) => (x.audience = audience))
    audit(ctx.user.id, "Published", `'${p.title}' → ${audienceLabel(audience, wsName)}`, projectId)
    notify({ userIds: projectUserIds(projectId), tier: p.actionRequired ? 1 : 2, title: `New: ${p.title}`, projectId, path: "/documents", canSee: seesItem(ctx, audience, p.authorId), exclude: ctx.user.id })
    return ok("Published.")
  })
}

export async function revisePublication(projectId: string, pubId: string, summary: string, changeNote: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!canPublish(ctx)) return fail("You need the publish right.")
    const d = db()
    const old = d.publications.find((x) => x.id === pubId && x.projectId === projectId)
    if (!old || old.state !== "published" || old.supersededById) return fail("Only the current published record can be revised.")
    if (changeNote.trim().length < 5) return fail("A change note is required.")
    const rev: Publication = { ...old, id: newId("pub"), summary: summary.trim(), version: old.version + 1, changeNote: changeNote.trim(), supersedesId: old.id, supersededById: undefined, publishedAt: nowIso(), createdAt: nowIso() }
    old.supersededById = rev.id
    d.publications.push(rev)
    d.threads.filter((t) => t.subject.id === old.id && t.purpose === "correction").forEach((t) => (t.resolved = true))
    audit(ctx.user.id, "Revised", `'${old.title}' v${old.version} superseded by v${rev.version}: ${changeNote}`, projectId)
    notify({ userIds: projectUserIds(projectId), tier: 2, title: `Revised: ${old.title} (v${rev.version})`, projectId, path: "/documents", canSee: seesItem(ctx, old.audience, old.authorId), exclude: ctx.user.id })
    return ok(`Version ${rev.version} published; v${old.version} kept in history.`)
  })
}

export async function retractPublication(projectId: string, pubId: string, reason: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectDirector(ctx)) return fail("Only the CEO can retract.")
    const p = db().publications.find((x) => x.id === pubId && x.projectId === projectId)
    if (!p) return fail("Not found.")
    if (reason.trim().length < MIN_REASON) return fail("A reason is required.")
    p.retracted = { reason: reason.trim(), at: nowIso(), by: ctx.user.id }
    audit(ctx.user.id, "Retracted", `'${p.title}': ${reason}`, projectId)
    return ok("Retracted.")
  })
}

export async function addComment(projectId: string, subject: { kind: "publication" | "document"; id: string }, body: string, audience: "shared" | "team", purpose: "discussion" | "correction" = "discussion") {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    const d = db()
    const item = subject.kind === "publication" ? d.publications.find((p) => p.id === subject.id) : d.documents.find((p) => p.id === subject.id)
    if (!item || item.projectId !== projectId || !canSeeAudience(ctx, item.audience, item.authorId)) return fail("Not found.")
    if (audience === "team" && !isProjectStaff(ctx)) return fail("Not allowed.")
    if (body.trim().length < 2) return fail("Write a comment.")
    let t = d.threads.find((x) => x.subject.id === subject.id && x.audience === audience && x.purpose === purpose && !x.resolved)
    if (!t) {
      t = { id: newId("th"), projectId, subject, audience, purpose, comments: [], resolved: false }
      d.threads.push(t)
    }
    t.comments.push({ id: newId("c"), authorId: ctx.user.id, body: body.trim(), at: nowIso() })
    if (purpose === "correction") {
      audit(ctx.user.id, "Correction requested", `'${"title" in item ? item.title : ""}': ${body}`, projectId)
      notify({ userIds: directors(projectId).concat(item.authorId), tier: 1, title: `Correction requested on ${"title" in item ? item.title : "record"}`, projectId, path: "/publications" })
    }
    return ok(purpose === "correction" ? "Correction request sent. The record stays unchanged until a revision is published." : "Comment added.")
  })
}

// ── Change requests ─────────────────────────────────────────────────────────
export async function submitChange(projectId: string, input: { category: ChangeCategory; what: string; why: string; timing: string; linkedDecisionId?: string }) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!canSubmitChange(ctx)) return fail("Not allowed.")
    if (input.what.trim().length < 5 || input.why.trim().length < 5) return fail("Tell us what should change and why.")
    const d = db()
    let audience: Audience = { kind: "client" }
    if (input.linkedDecisionId) {
      const dec = d.decisions.find((x) => x.id === input.linkedDecisionId && x.projectId === projectId)
      if (!dec || !canSeeAudience(ctx, dec.audience, dec.authorId)) return fail("Not found.")
      dec.state = "under_revisit"
      audience = dec.audience
    } else if (ctx.user.kind === "client_stakeholder" && ctx.membership?.workstreamIds[0]) {
      audience = { kind: "workstream", workstreamId: ctx.membership.workstreamIds[0] }
    }
    const number = d.changeRequests.filter((c) => c.projectId === projectId).length + 1
    const cr = { id: newId("cr"), number, projectId, category: input.category, what: input.what.trim(), why: input.why.trim(), timing: input.timing.trim(), submittedAt: nowIso(), state: "submitted" as const, linkedDecisionId: input.linkedDecisionId, audience, authorId: ctx.user.id }
    d.changeRequests.push(cr)
    audit(ctx.user.id, "Change requested", `CR-${number} (${input.category}): ${cr.what}`, projectId)
    notify({ userIds: directors(projectId), tier: 1, title: `Change request CR-${number}: ${cr.what}`, projectId, path: "/decisions" })
    return ok(`Change request CR-${number} submitted. You can track it under Decisions.`)
  })
}

function reactivateDecision(id?: string) {
  const dec = id ? db().decisions.find((x) => x.id === id) : undefined
  if (dec && dec.state === "under_revisit") dec.state = "active"
}

export async function triageChange(projectId: string, crId: string, op: "acknowledge" | "clarify" | "decline", text: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isOwner(ctx)) return fail("Only the project Owner triages change requests.")
    const c = db().changeRequests.find((x) => x.id === crId && x.projectId === projectId)
    if (!c) return fail("Not found.")
    if (!["submitted", "under_review", "needs_clarification"].includes(c.state)) return fail("Already past triage.")
    if (op === "acknowledge") c.state = "under_review"
    if (op === "clarify") {
      if (text.trim().length < 5) return fail("Write the question.")
      c.state = "needs_clarification"
      c.clarification = { question: text.trim() }
      notify({ userIds: [c.authorId], tier: 1, title: `Clarification needed on CR-${c.number}`, projectId, path: `/decisions?cr=${c.id}` })
    }
    if (op === "decline") {
      if (text.trim().length < MIN_REASON) return fail("A reason is required to decline.")
      c.state = "declined"
      c.declineReason = text.trim()
      reactivateDecision(c.linkedDecisionId)
      notify({ userIds: [c.authorId], tier: 1, title: `CR-${c.number} declined`, projectId, path: "/decisions" })
    }
    audit(ctx.user.id, "Change triaged", `CR-${c.number}: ${op}${text ? ` — ${text}` : ""}`, projectId)
    return ok("Updated.")
  })
}

export async function answerClarification(projectId: string, crId: string, answer: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    const c = db().changeRequests.find((x) => x.id === crId && x.projectId === projectId)
    if (!c || c.authorId !== ctx.user.id || c.state !== "needs_clarification") return fail("Not found.")
    if (answer.trim().length < 3) return fail("Write an answer.")
    c.clarification = { question: c.clarification?.question ?? "", answer: answer.trim() }
    c.state = "under_review"
    audit(ctx.user.id, "Clarification answered", `CR-${c.number}`, projectId)
    notify({ userIds: directors(projectId), tier: 1, title: `CR-${c.number} clarified`, projectId, path: "/decisions" })
    return ok("Answer sent.")
  })
}

export async function withdrawChange(projectId: string, crId: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    const c = db().changeRequests.find((x) => x.id === crId && x.projectId === projectId)
    if (!c || c.authorId !== ctx.user.id) return fail("Not found.")
    if (["approved", "implemented", "declined", "withdrawn"].includes(c.state)) return fail("Too late to withdraw.")
    c.state = "withdrawn"
    if (c.approvalId) {
      const ap = db().approvals.find((a) => a.id === c.approvalId)
      if (ap && ap.state === "pending") ap.state = "withdrawn"
    }
    reactivateDecision(c.linkedDecisionId)
    audit(ctx.user.id, "Change withdrawn", `CR-${c.number}`, projectId)
    return ok("Withdrawn.")
  })
}

export async function saveImpact(projectId: string, crId: string, input: Omit<ImpactReview, "at" | "by" | "needsClientApproval">) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isOwner(ctx)) return fail("Only the project Owner completes the impact review.")
    const c = db().changeRequests.find((x) => x.id === crId && x.projectId === projectId)
    if (!c || !["under_review", "impact_review"].includes(c.state)) return fail("Acknowledge the request first.")
    if (input.scope.trim().length < 5) return fail("Describe the scope impact (write 'None' if none).")
    const needsClientApproval = input.costDelta !== 0 || input.dateShiftDays !== 0 || c.category === "change scope"
    c.impact = { ...input, needsClientApproval, at: nowIso(), by: ctx.user.id }
    c.state = "impact_review"
    audit(ctx.user.id, "Impact reviewed", `CR-${c.number}: ${input.dateShiftDays}d, ${input.effortDays} person-days, cost Δ ${input.costDelta}`, projectId)
    return ok(needsClientApproval ? "Impact recorded — this change needs client approval (Tier A)." : "Impact recorded — can be approved internally.")
  })
}

export async function advanceChange(projectId: string, crId: string, op: "send_for_approval" | "approve_internal" | "implement") {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isOwner(ctx)) return fail("Only the project Owner.")
    const d = db()
    const c = d.changeRequests.find((x) => x.id === crId && x.projectId === projectId)
    if (!c) return fail("Not found.")
    if (op !== "implement" && (c.state !== "impact_review" || !c.impact)) return fail("An impact review is required first (T-21).")
    if (op === "send_for_approval") {
      const leads = clientLeads(projectId)
      if (!leads.length) return fail("No Client Lead on this project.")
      const ap = { id: newId("ap"), projectId, title: `CR-${c.number} ${c.what}`, subject: { kind: "change_request" as const, id: c.id }, tier: (c.impact!.costDelta !== 0 ? "A" : "B") as "A" | "B", approverIds: leads, rule: "any" as const, due: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), state: "pending" as const, responses: [], requestedBy: ctx.user.id, createdAt: nowIso() }
      d.approvals.push(ap)
      c.approvalId = ap.id
      c.state = "awaiting_client_approval"
      notify({ userIds: leads, tier: 1, title: `Approval requested: CR-${c.number}`, projectId, path: `?approve=${ap.id}` })
      audit(ctx.user.id, "Approval requested", `CR-${c.number} → client (Tier ${ap.tier})`, projectId)
      return ok("Sent to the client for approval.")
    }
    if (op === "approve_internal") {
      if (c.impact!.needsClientApproval) return fail("This change alters dates, cost or scope — client approval is required.")
      c.state = "approved"
      audit(ctx.user.id, "Change approved", `CR-${c.number} (internal only)`, projectId)
      return ok("Approved internally.")
    }
    // implement: update linked records, then mark Implemented (REQ-CHG-05)
    if (c.state !== "approved") return fail("Only approved change requests can be implemented.")
    const shift = c.impact?.dateShiftDays ?? 0
    if (shift) {
      for (const m of d.milestones.filter((x) => c.impact!.milestoneIds.includes(x.id))) {
        const to = new Date(new Date(`${m.currentDate}T12:00:00Z`).getTime() + shift * 864e5).toISOString().slice(0, 10)
        m.dateChanges.push({ from: m.currentDate, to, reason: `Approved change request CR-${c.number}: ${c.what}`, linkKind: "change_request", linkId: c.id, at: nowIso(), by: ctx.user.id })
        m.currentDate = to
      }
    }
    if (c.linkedDecisionId) {
      const old = d.decisions.find((x) => x.id === c.linkedDecisionId)
      if (old) {
        const nid = newId("dec")
        d.decisions.push({ id: nid, projectId, statement: c.what, context: `CR-${c.number}`, partyIds: [c.authorId, ctx.user.id], date: todayIso(), sourceChangeRequestId: c.id, state: "active", audience: old.audience, authorId: ctx.user.id })
        old.state = "superseded"
        old.supersededById = nid
      }
    } else {
      d.decisions.push({ id: newId("dec"), projectId, statement: `Change CR-${c.number} implemented: ${c.what}`, partyIds: [c.authorId, ctx.user.id], date: todayIso(), sourceChangeRequestId: c.id, state: "active", audience: c.audience, authorId: ctx.user.id })
    }
    c.state = "implemented"
    audit(ctx.user.id, "Change implemented", `CR-${c.number}: ${shift ? `${c.impact!.milestoneIds.length} milestone date(s) moved ${shift}d with linked reason; ` : ""}decision register updated`, projectId)
    notify({ userIds: projectUserIds(projectId), tier: 1, title: `Change implemented: CR-${c.number}`, projectId, path: "/decisions", canSee: seesItem(ctx, c.audience, c.authorId) })
    return ok("Implemented. Linked dates and decisions updated with traceable reasons.")
  })
}

// ── Commercial ──────────────────────────────────────────────────────────────
export async function newEstimateVersion(projectId: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectDirector(ctx)) return fail("Only the CEO drafts estimates.")
    const d = db()
    const latest = d.estimates.filter((e) => e.projectId === projectId).sort((a, b) => b.version - a.version)[0]
    if (latest && latest.state === "draft") return fail(`v${latest.version} is already a draft — edit it.`)
    const base = latest ?? { scope: "", deliverables: [], effortDays: 0, durationWeeks: 0, lineItems: [], expenses: 0, taxRate: 18, assumptions: [], exclusions: [], detailLevel: "line_items" as const, internal: { costPerDay: 42000, targetMarginPct: 38, notes: "" } }
    d.estimates.push({ ...structuredClone(base), id: newId("est"), projectId, version: (latest?.version ?? 0) + 1, state: "draft", validUntil: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), createdAt: nowIso(), createdBy: ctx.user.id, sharedAt: undefined, approvedAt: undefined, scheduleSnapshot: [] })
    audit(ctx.user.id, "Estimate drafted", `v${(latest?.version ?? 0) + 1} created from v${latest?.version ?? "–"}`, projectId)
    return ok("New draft version created.")
  })
}

export async function updateEstimate(projectId: string, id: string, patch: { scope: string; effortDays: number; durationWeeks: number; expenses: number; taxRate: number; lineItems: LineItem[]; detailLevel: "line_items" | "total"; internalNotes: string; costPerDay: number; targetMarginPct: number; validUntil: string }) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectDirector(ctx)) return fail("Only the CEO edits estimates.")
    const e = db().estimates.find((x) => x.id === id && x.projectId === projectId)
    if (!e) return fail("Not found.")
    if (e.state !== "draft") return fail("Shared or reviewed versions are immutable — create a new version.")
    Object.assign(e, { scope: patch.scope, effortDays: patch.effortDays, durationWeeks: patch.durationWeeks, expenses: patch.expenses, taxRate: patch.taxRate, lineItems: patch.lineItems, detailLevel: patch.detailLevel, validUntil: patch.validUntil })
    e.internal = { costPerDay: patch.costPerDay, targetMarginPct: patch.targetMarginPct, notes: patch.internalNotes }
    audit(ctx.user.id, "Estimate edited", `v${e.version} draft updated`, projectId)
    return ok("Draft saved.")
  })
}

export async function advanceEstimate(projectId: string, id: string, op: "review" | "share" | "withdraw") {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectDirector(ctx)) return fail("Only the CEO can share an estimate.")
    const d = db()
    const e = d.estimates.find((x) => x.id === id && x.projectId === projectId)
    if (!e) return fail("Not found.")
    if (op === "review") {
      if (e.state !== "draft") return fail("Only drafts go to internal review.")
      if (!e.effortDays || !e.durationWeeks || !e.lineItems.length) return fail("Effort, duration and line items are required.")
      e.state = "internal_review"
      e.scheduleSnapshot = d.milestones.filter((m) => m.projectId === projectId && m.state !== "dropped").map((m) => ({ milestoneId: m.id, name: m.name, date: m.currentDate }))
      audit(ctx.user.id, "Estimate to review", `v${e.version} locked for internal review; schedule snapshot captured`, projectId)
      return ok("Moved to internal review. Schedule snapshot captured.")
    }
    if (op === "withdraw") {
      if (e.state !== "shared") return fail("Only shared versions can be withdrawn.")
      e.state = "withdrawn"
      d.approvals.filter((a) => a.subject.kind === "estimate" && a.subject.id === e.id && a.state === "pending").forEach((a) => (a.state = "withdrawn"))
      audit(ctx.user.id, "Estimate withdrawn", `v${e.version}`, projectId)
      return ok("Withdrawn.")
    }
    if (e.state !== "internal_review") return fail("Move to internal review first.")
    const leads = clientLeads(projectId)
    if (!leads.length) return fail("Invite a Client Lead before sharing.")
    // A newer shared version supersedes older shared ones and their pending approvals.
    for (const old of d.estimates.filter((x) => x.projectId === projectId && x.state === "shared")) {
      old.state = "superseded"
      d.approvals.filter((a) => a.subject.kind === "estimate" && a.subject.id === old.id && a.state === "pending").forEach((a) => (a.state = "superseded"))
    }
    e.state = "shared"
    e.sharedAt = nowIso()
    const ap = { id: newId("ap"), projectId, title: `${ctx.project.name} — estimate v${e.version}`, subject: { kind: "estimate" as const, id: e.id, version: e.version }, tier: "A" as const, approverIds: leads, rule: "any" as const, due: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), state: "pending" as const, responses: [], requestedBy: ctx.user.id, createdAt: nowIso() }
    d.approvals.push(ap)
    if (ctx.project.lifecycle === "setup") {
      ctx.project.lifecycle = "proposal"
      audit("system", "Lifecycle changed", "Setup → Proposal (estimate shared, Client Lead invited)", projectId)
    }
    audit(ctx.user.id, "Estimate shared", `v${e.version} shared with ${leads.map(userName).join(", ")} (Tier A approval requested)`, projectId)
    notify({ userIds: leads, tier: 1, title: `Estimate v${e.version} shared for your approval`, projectId, path: `?approve=${ap.id}`, canSee: (u) => canSeeCommercial(viewerOf(u, ctx)) })
    return ok("Shared. Content is now locked; Tier A approval requested.")
  })
}

// ── People & access ─────────────────────────────────────────────────────────
export async function toggleWorkstream(projectId: string, userId: string, wsId: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!canManageAccess(ctx)) return fail("You don't have the manage-access right.")
    const m = db().memberships.find((x) => x.projectId === projectId && x.userId === userId)
    if (!m) return fail("Not a member.")
    const had = m.workstreamIds.includes(wsId)
    m.workstreamIds = had ? m.workstreamIds.filter((w) => w !== wsId) : [...m.workstreamIds, wsId]
    m.preset = "Custom"
    audit(ctx.user.id, had ? "Access revoked" : "Access granted", `${userName(userId)} ${had ? "removed from" : "added to"} workstream ${wsName(wsId)}`, projectId, true)
    return ok("Access updated.")
  })
}

export async function setPublishRight(projectId: string, userId: string, value: boolean) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!canManageAccess(ctx)) return fail("You don't have the manage-access right.")
    const m = db().memberships.find((x) => x.projectId === projectId && x.userId === userId)
    if (!m || m.role !== "team") return fail("Publish right applies to Team Members.")
    m.publishRight = value
    audit(ctx.user.id, value ? "Access granted" : "Access revoked", `Publish right ${value ? "granted to" : "removed from"} ${userName(userId)}`, projectId, true)
    return ok("Publish right updated.")
  })
}

export async function removeMember(projectId: string, userId: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!canManageAccess(ctx)) return fail("You don't have the manage-access right.")
    if (userId === ctx.project.ownerId) return fail("The Owner cannot be removed.")
    const d = db()
    d.memberships = d.memberships.filter((x) => !(x.projectId === projectId && x.userId === userId))
    const flagged = d.approvals.filter((a) => a.projectId === projectId && a.state === "pending" && a.approverIds.includes(userId))
    flagged.forEach((a) => (a.unavailableApproverIds = [...(a.unavailableApproverIds ?? []), userId]))
    const open = d.actions.filter((a) => a.projectId === projectId && a.ownerId === userId && a.state === "open")
    audit(ctx.user.id, "Access revoked", `${userName(userId)} removed from project; ${flagged.length} approval(s) flagged "approver unavailable", ${open.length} open action(s) need reassignment`, projectId, true)
    return ok(`Removed. ${flagged.length} approval(s) flagged, ${open.length} action(s) need reassignment.`)
  })
}

export async function requestAccess(projectId: string, documentId: string, reason: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    const doc = db().documents.find((x) => x.id === documentId && x.projectId === projectId)
    if (!doc || doc.audience.kind !== "named") return fail("Not found.")
    if (reason.trim().length < MIN_REASON) return fail("Give a reason for the request.")
    if (db().accessRequests.some((r) => r.documentId === documentId && r.userId === ctx.user.id && r.state === "pending")) return ok("Request already pending.")
    db().accessRequests.push({ id: newId("acr"), projectId, documentId, userId: ctx.user.id, reason: reason.trim(), state: "pending", at: nowIso() })
    audit(ctx.user.id, "Access requested", `${doc.title} (Named): ${reason}`, projectId, true)
    notify({ userIds: [doc.authorId, ctx.project.ownerId], tier: 1, title: `${ctx.user.name} requests access to a restricted item`, projectId, path: "/people" })
    return ok("Access requested. The owner will decide.")
  })
}

export async function decideAccess(projectId: string, requestId: string, grant: boolean) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    const d = db()
    const r = d.accessRequests.find((x) => x.id === requestId && x.projectId === projectId)
    const doc = r && d.documents.find((x) => x.id === r.documentId)
    if (!r || !doc || r.state !== "pending") return fail("Not found.")
    if (!(isOwner(ctx) || doc.authorId === ctx.user.id)) return fail("Only the item author or project Owner decides.")
    r.state = grant ? "granted" : "declined"
    r.decidedBy = ctx.user.id
    if (grant && doc.audience.kind === "named") doc.audience = { kind: "named", userIds: [...doc.audience.userIds, r.userId] }
    audit(ctx.user.id, grant ? "Access granted" : "Access declined", `${userName(r.userId)} → ${doc.title}`, projectId, true)
    notify({ userIds: [r.userId], tier: 1, title: `Access ${grant ? "granted" : "declined"}: ${grant ? doc.title : "restricted item"}`, projectId, path: "/documents" })
    return ok(grant ? "Access granted." : "Declined. Requester keeps metadata only.")
  })
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
export async function lifecycleAction(projectId: string, op: "pause" | "resume" | "request_cancel", reason: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    const p = ctx.project
    if (op === "pause") {
      if (!isOwner(ctx)) return fail("Only the Owner can pause.")
      if (p.lifecycle !== "active") return fail("Only active projects can be paused.")
      if (reason.trim().length < MIN_REASON) return fail("A reason is required.")
      p.lifecycle = "paused"
      p.pause = { reason: reason.trim(), at: nowIso(), by: ctx.user.id }
      audit(ctx.user.id, "Lifecycle changed", `Active → Paused: ${reason}`, projectId)
      notify({ userIds: projectUserIds(projectId), tier: 1, title: `${p.name} paused`, projectId, exclude: ctx.user.id })
      return ok("Paused. Overdue alerts are suspended.")
    }
    if (op === "resume") {
      if (!isOwner(ctx)) return fail("Only the Owner can resume.")
      if (p.lifecycle !== "paused") return fail("Not paused.")
      if (reason !== "confirmed") return fail("Confirm the current milestone dates first.")
      p.lifecycle = "active"
      p.pause = undefined
      audit(ctx.user.id, "Lifecycle changed", "Paused → Active (current milestone dates confirmed)", projectId)
      notify({ userIds: projectUserIds(projectId), tier: 1, title: `${p.name} resumed`, projectId, exclude: ctx.user.id })
      return ok("Resumed.")
    }
    // request_cancel: the owner asks; an Admin confirms from the Admin console (adminConfirmCancel).
    if (!isOwner(ctx)) return fail("Only the Owner can request cancellation.")
    if (p.cancelRequest) return fail("Cancellation is already waiting for Admin confirmation.")
    if (reason.trim().length < MIN_REASON) return fail("A reason is required.")
    p.cancelRequest = { reason: reason.trim(), at: nowIso(), by: ctx.user.id }
    audit(ctx.user.id, "Cancellation requested", reason, projectId)
    notify({ userIds: db().users.filter((u) => u.kind === "admin").map((u) => u.id), tier: 1, title: `Cancellation of ${p.code} needs Admin confirmation`, projectId: undefined })
    return ok("Cancellation requested — an Admin must confirm.")
  })
}

/**
 * Second-person check for cancellation. With a single CEO, the Admin confirms.
 * Uses only the project shell (name, state, the CEO's reason) — never project content.
 */
export async function adminConfirmCancel(projectId: string) {
  return guard(async () => {
    const admin = await requireAdmin()
    const d = db()
    const p = d.projects.find((x) => x.id === projectId)
    if (!p || !p.cancelRequest) return fail("No cancellation is waiting for confirmation.")
    if (["closed", "cancelled", "archived"].includes(p.lifecycle)) return fail("This project is already finished.")
    p.lifecycle = "cancelled"
    d.approvals.filter((a) => a.projectId === projectId && a.state === "pending").forEach((a) => (a.state = "withdrawn"))
    d.changeRequests.filter((c) => c.projectId === projectId && !["implemented", "declined", "withdrawn"].includes(c.state)).forEach((c) => (c.state = "withdrawn"))
    d.actions.filter((a) => a.projectId === projectId && a.state === "open").forEach((a) => (a.state = "cancelled"))
    audit(admin.id, "Lifecycle changed", `→ Cancelled (confirmed by Admin ${admin.name}). Reason: ${p.cancelRequest.reason}`, projectId, true)
    notify({ userIds: projectUserIds(projectId), tier: 1, title: `${p.name} cancelled`, projectId })
    return ok("Project cancelled. Open items withdrawn; the project is read-only.")
  })
}

export async function reopenProject(projectId: string, reason: string) {
  const user = await getViewer()
  if (!user) return fail("No session")
  const ctx = ctxFor(user, projectId)
  if (!ctx || !isProjectDirector(ctx)) return fail("Only the CEO can reopen.")
  if (!["closed", "archived", "cancelled"].includes(ctx.project.lifecycle)) return fail("Not closed.")
  if (reason.trim().length < MIN_REASON) return fail("A reason is required.")
  const from = ctx.project.lifecycle
  ctx.project.lifecycle = "active"
  ctx.project.cancelRequest = undefined
  if (ctx.project.closure) {
    ctx.project.previousClosures = [...(ctx.project.previousClosures ?? []), ctx.project.closure]
    ctx.project.closure = undefined
  }
  audit(user.id, "Lifecycle changed", `${from} → Active (reopened): ${reason}`, projectId)
  revalidatePath("/", "layout")
  return ok("Reopened.")
}

// ── Closure (REQ-CLS-01…05) ─────────────────────────────────────────────────
const OPEN_CR = (state: string) => !["implemented", "declined", "withdrawn"].includes(state)

export async function startClosing(projectId: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isOwner(ctx)) return fail("Only the project Owner can start closure.")
    const p = ctx.project
    if (p.lifecycle !== "active") return fail("Only active projects can move to Closing.")
    const d = db()
    const open = d.milestones.filter((m) => m.projectId === projectId && m.state !== "accepted" && m.state !== "dropped")
    if (open.length) return fail(`${open.length} milestone(s) are not yet Accepted or Dropped.`)
    if (d.changeRequests.some((c) => c.projectId === projectId && OPEN_CR(c.state))) return fail("Resolve all open change requests first.")
    p.lifecycle = "closing"
    p.closure = {
      startedAt: nowIso(),
      startedBy: ctx.user.id,
      items: CLOSURE_ITEMS.map(([key, label]) => ({ key, label, state: "pending" as const })),
    }
    audit(ctx.user.id, "Lifecycle changed", "Active → Closing. Closure checklist generated", projectId)
    notify({ userIds: projectUserIds(projectId), tier: 1, title: `${p.name} is closing`, projectId, exclude: ctx.user.id })
    return ok("Moved to Closing. Work through the checklist.")
  })
}

/** Each item can be Met (with a system check where one exists) or Waived with a reason. */
export async function setClosureItem(projectId: string, key: ClosureKey, state: "met" | "waived" | "pending", reason = "") {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectDirector(ctx)) return fail("Only the CEO manages the closure checklist.")
    const p = ctx.project
    const c = p.closure
    if (p.lifecycle !== "closing" || !c || c.finalizedAt) return fail("The closure record is not open.")
    const item = c.items.find((i) => i.key === key)
    if (!item) return fail("Not found.")
    const d = db()
    if (state === "waived" && reason.trim().length < MIN_REASON) return fail("A waiver needs a recorded reason.")
    if (state === "met") {
      if (key === "deliverables" && d.milestones.some((m) => m.projectId === projectId && m.acceptance === "client" && m.state !== "accepted" && m.state !== "dropped"))
        return fail("Some client deliverables are not accepted.")
      if (key === "actions" && d.actions.some((a) => a.projectId === projectId && a.state === "open"))
        return fail("There are still open actions — resolve, cancel or transfer them.")
      if (key === "feedback" && !c.survey) return fail("The Client Lead has not completed or skipped the feedback survey yet.")
      if (key === "final_status" && !d.statuses.some((s) => s.projectId === projectId && s.at >= c.startedAt))
        return fail("Write a final status statement after closure started.")
    }
    item.state = state
    item.waiverReason = state === "waived" ? reason.trim() : undefined
    item.by = ctx.user.id
    item.at = nowIso()
    audit(ctx.user.id, "Closure checklist", `${item.label}: ${state}${state === "waived" ? ` — ${reason}` : ""}`, projectId)
    return ok(state === "waived" ? "Waived with reason." : state === "met" ? "Marked met." : "Reset to pending.")
  })
}

export async function requestFinalAcceptance(projectId: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isOwner(ctx)) return fail("Only the project Owner requests final acceptance.")
    const p = ctx.project
    if (p.lifecycle !== "closing" || !p.closure) return fail("Start closure first.")
    const d = db()
    const existing = d.approvals.find((a) => a.id === p.closure!.finalApprovalId)
    if (existing && (existing.state === "pending" || existing.state === "approved")) return fail(`Final acceptance is already ${existing.state}.`)
    const leads = clientLeads(projectId)
    if (!leads.length) return fail("No Client Lead on this project.")
    const ap = { id: newId("ap"), projectId, title: `Final acceptance — ${p.name}`, subject: { kind: "final" as const, projectId }, tier: "A" as const, approverIds: leads, rule: "any" as const, due: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), state: "pending" as const, responses: [], requestedBy: ctx.user.id, createdAt: nowIso() }
    d.approvals.push(ap)
    p.closure.finalApprovalId = ap.id
    audit(ctx.user.id, "Approval requested", `Final acceptance → ${leads.map(userName).join(", ")} (Tier A)`, projectId)
    notify({ userIds: leads, tier: 1, title: `Final acceptance requested: ${p.name}`, projectId, path: `?approve=${ap.id}` })
    return ok("Final acceptance requested (Tier A, fresh sign-in).")
  })
}

export async function finalizeClosure(projectId: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isOwner(ctx)) return fail("Only the project Owner finalises closure.")
    const p = ctx.project
    const c = p.closure
    if (p.lifecycle !== "closing" || !c) return fail("Project is not closing.")
    const pending = c.items.filter((i) => i.state === "pending")
    if (pending.length) return fail(`Cannot close: ${pending.length} checklist item(s) still Pending.`)
    const ap = db().approvals.find((a) => a.id === c.finalApprovalId)
    if (!ap || ap.state !== "approved") return fail("Final acceptance has not been approved by the client.")
    c.finalizedAt = nowIso()
    c.finalizedBy = ctx.user.id
    p.lifecycle = "closed"
    audit(ctx.user.id, "Lifecycle changed", "Closing → Closed. Closure record finalised and locked; project is read-only", projectId)
    notify({ userIds: projectUserIds(projectId), tier: 1, title: `${p.name} is closed`, projectId, exclude: ctx.user.id })
    return ok("Closed. The closure record is final and the project is now read-only.")
  })
}

/** The survey is allowed during Closing and after Closed, so it bypasses the read-only guard. */
export async function submitSurvey(projectId: string, input: { skip: true } | Omit<Survey, "by" | "at">) {
  return guard(async () => {
    const user = await getViewer()
    if (!user) throw new Refused("Your session has ended.")
    const ctx = ctxFor(user, projectId)
    if (!ctx || !hasShell(ctx) || ctx.membership?.role !== "client_lead") return fail("Only the Client Lead completes the closure survey.")
    const c = ctx.project.closure
    if (!c) return fail("No open feedback request.")
    if (c.survey) return ok("Your feedback is already recorded.")
    if ("skip" in input) {
      c.survey = { skipped: true, by: user.id, at: nowIso() }
      audit(user.id, "Feedback skipped", "Closure survey skipped", projectId)
      return ok("Skipped. Thank you.")
    }
    const scores = [input.overall, input.usefulness, input.clarity, input.timeline, input.responsiveness]
    if (scores.some((n) => !(n >= 1 && n <= 5))) return fail("Rate each question from 1 to 5.")
    c.survey = { ...input, comments: input.comments.trim(), by: user.id, at: nowIso() }
    audit(user.id, "Feedback recorded", `Closure survey completed (overall ${input.overall}/5)`, projectId)
    notify({ userIds: directors(projectId), tier: 2, title: `${user.name} shared closure feedback`, projectId })
    return ok("Thank you — your feedback is recorded.")
  })
}

export async function archiveProject(projectId: string) {
  const user = await getViewer()
  if (!user) return fail("No session")
  const ctx = ctxFor(user, projectId)
  if (!ctx || !isOwner(ctx)) return fail("Only the project Owner can archive.")
  if (!["closed", "cancelled"].includes(ctx.project.lifecycle)) return fail("Only closed or cancelled projects can be archived.")
  const from = ctx.project.lifecycle
  ctx.project.lifecycle = "archived"
  audit(user.id, "Lifecycle changed", `${from} → Archived (manual)`, projectId)
  revalidatePath("/", "layout")
  return ok("Archived.")
}

// ── Projects: creation & setup (REQ-PRJ-01, REQ-ACC-08, REQ-PLN-02) ──────────
export interface NewProjectInput {
  name: string
  clientOrgId: string
  ownerId: string
  objectives: string
  scope: string
  plannedStart: string
  targetEnd: string
  workstreams: string[]
  teamIds: string[]
  clientLeadId?: string
}

export async function createProject(input: NewProjectInput): Promise<Result> {
  return guard(async () => {
    const actor = await getViewer()
    if (!actor || (actor.kind !== "director" && actor.kind !== "admin")) return fail("Only the CEO or Admin can create a project.")
    const d = db()
    const org = d.orgs.find((o) => o.id === input.clientOrgId && o.kind === "client")
    if (!org) return fail("Choose a client organisation.")
    if (input.name.trim().length < 3) return fail("Give the project a name.")
    if (input.objectives.trim().length < 10 || input.scope.trim().length < 10) return fail("Objectives and scope summary are required.")
    // A project owner is always a Morphoverse CEO (A-02); the CEO creating a project owns it.
    const ownerId = actor.kind === "director" ? actor.id : input.ownerId
    const owner = d.users.find((u) => u.id === ownerId && u.kind === "director" && u.status === "active")
    if (!owner) return fail("The owner must be an active Morphoverse CEO.")
    if (!input.plannedStart || !input.targetEnd || input.targetEnd <= input.plannedStart) return fail("Target end must be after the planned start.")
    const wsNames = [...new Set(input.workstreams.map((w) => w.trim()).filter(Boolean))]
    if (wsNames.length === 0) return fail("Add at least one workstream.")
    const lead = input.clientLeadId ? d.users.find((u) => u.id === input.clientLeadId && u.orgId === org.id && u.kind !== "exec") : undefined
    if (input.clientLeadId && !lead) return fail("The Client Lead must belong to the client organisation.")

    const year = input.plannedStart.slice(0, 4)
    const seq = d.projects.filter((p) => p.code.startsWith(`${org.code}-${year}-`)).length + 1
    const id = newId("p")
    const code = `${org.code}-${year}-${String(seq).padStart(3, "0")}`
    d.projects.push({
      id, code, name: input.name.trim(), clientOrgId: org.id, ownerId: owner.id, lifecycle: "setup",
      objectives: input.objectives.trim(), scope: input.scope.trim(), timezone: "Asia/Kolkata", currency: "INR",
      plannedStart: input.plannedStart, targetEnd: input.targetEnd,
    })
    DEFAULT_PHASES.forEach((name, i) => d.phases.push({ id: `${id}-ph${i + 1}`, projectId: id, name, order: i + 1 }))
    const wsIds = wsNames.map((name) => {
      const w = { id: newId("ws"), projectId: id, name }
      d.workstreams.push(w)
      return w.id
    })
    const add = (userId: string, role: Membership["role"], extra: Partial<Membership> = {}) =>
      d.memberships.push({ projectId: id, userId, role, workstreamIds: wsIds, publishRight: role === "owner" || role === "director", manageAccess: role === "owner", preset: role === "owner" ? "Full project access" : role === "client_lead" ? "Approver" : "Collaborator", ...extra })
    add(owner.id, "owner")
    for (const uid of new Set(input.teamIds)) {
      const u = d.users.find((x) => x.id === uid && x.orgId === "org-morph" && (x.kind === "team" || x.kind === "director"))
      if (u && u.id !== owner.id) add(u.id, u.kind === "director" ? "director" : "team")
    }
    if (lead) add(lead.id, "client_lead")
    audit(actor.id, "Project created", `${code} created by ${actor.name} from the default 8-phase template; owner ${owner.name}; ${wsNames.length} workstream(s)`, id, actor.kind === "admin")
    notify({ userIds: d.memberships.filter((m) => m.projectId === id).map((m) => m.userId), tier: 1, title: `You were added to ${input.name.trim()} (${code})`, projectId: id, exclude: actor.id, canSee: (u) => !isClientKind(u.kind) })
    return { ok: true, message: `Created ${code} in Setup. Clients see nothing until an estimate is shared.`, id }
  })
}

export async function addWorkstream(projectId: string, name: string) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!canManageAccess(ctx)) return fail("You don't have the manage-access right.")
    if (name.trim().length < 2) return fail("Name the workstream.")
    if (db().workstreams.some((w) => w.projectId === projectId && w.name.toLowerCase() === name.trim().toLowerCase())) return fail("That workstream exists.")
    const w = { id: newId("ws"), projectId, name: name.trim() }
    db().workstreams.push(w)
    // The owner always spans every workstream.
    db().memberships.filter((m) => m.projectId === projectId && m.role === "owner").forEach((m) => m.workstreamIds.push(w.id))
    audit(ctx.user.id, "Workstream added", w.name, projectId)
    return ok(`Workstream “${w.name}” added. Members join it explicitly.`)
  })
}

export async function addMember(projectId: string, userId: string, role: Membership["role"], workstreamIds: string[]) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!canManageAccess(ctx)) return fail("You don't have the manage-access right.")
    const d = db()
    const u = d.users.find((x) => x.id === userId && x.status !== "deactivated")
    if (!u) return fail("Choose a user.")
    if (d.memberships.some((m) => m.projectId === projectId && m.userId === userId)) return fail(`${u.name} is already a member.`)
    if (role === "owner") return fail("A project has one owner.")
    const staffRole = role === "director" || role === "team"
    if (staffRole && !(u.kind === "director" || u.kind === "team")) return fail("Only Morphoverse staff can hold a staff role.")
    if (staffRole && role === "director" && u.kind !== "director") return fail("Only the CEO can join as CEO.")
    if (!staffRole && (u.orgId !== ctx.project.clientOrgId || u.kind === "exec")) return fail("Client members must belong to this project's client organisation.")
    const valid = workstreamIds.filter((w) => d.workstreams.some((x) => x.id === w && x.projectId === projectId))
    d.memberships.push({ projectId, userId, role, workstreamIds: valid, publishRight: role === "director", manageAccess: false, preset: role === "client_lead" ? "Approver" : staffRole ? "Collaborator" : "Workstream contributor" })
    audit(ctx.user.id, "Access granted", `${u.name} added as ${role.replace("_", " ")}${valid.length ? ` to ${valid.map(wsName).join(", ")}` : " (no workstreams)"}`, projectId, true)
    if (staffRole || ctx.project.lifecycle !== "setup")
      notify({ userIds: [u.id], tier: 1, title: `You were added to ${ctx.project.name}`, projectId })
    return ok(`${u.name} added.`)
  })
}

export async function addMilestone(projectId: string, input: { name: string; phaseId: string; workstreamId?: string; ownerId: string; counterpartId?: string; acceptance: "client" | "internal"; criteria: string; date: string; changeRequestId?: string }) {
  return guard(async () => {
    const ctx = await requireCtx(projectId)
    if (!isProjectDirector(ctx)) return fail("Only the CEO adds milestones.")
    const d = db()
    if (input.name.trim().length < 3) return fail("Name the milestone.")
    if (!d.phases.some((p) => p.id === input.phaseId && p.projectId === projectId)) return fail("Choose a phase.")
    if (!input.date) return fail("Set a date.")
    if (input.acceptance === "client" && input.criteria.trim().length < 5) return fail("Acceptance criteria are required for client-acceptance milestones.")
    if (!d.memberships.some((m) => m.projectId === projectId && m.userId === input.ownerId)) return fail("The owner must be a project member.")
    if (input.workstreamId && !d.workstreams.some((w) => w.id === input.workstreamId && w.projectId === projectId)) return fail("Unknown workstream.")
    // After the first estimate approval the plan is baselined: new commitments come through a change request.
    const baselined = !["setup", "proposal"].includes(ctx.project.lifecycle)
    if (baselined) {
      const cr = d.changeRequests.find((c) => c.id === input.changeRequestId && c.projectId === projectId)
      if (!cr || !["approved", "implemented"].includes(cr.state)) return fail("The plan is baselined — link an approved change request to add a milestone.")
    }
    const audience: Audience = input.workstreamId ? { kind: "workstream", workstreamId: input.workstreamId } : { kind: "client" }
    d.milestones.push({
      id: newId("m"), projectId, phaseId: input.phaseId, name: input.name.trim(), description: "", ownerId: input.ownerId,
      counterpartId: input.counterpartId || undefined, acceptance: input.acceptance, criteria: input.criteria.trim(),
      baselineDate: baselined ? input.date : undefined, currentDate: input.date, state: "planned", dateChanges: [], audience, authorId: ctx.user.id,
    })
    audit(ctx.user.id, "Milestone added", `${input.name.trim()} (${fmtDate(input.date)})${baselined ? ` via ${d.changeRequests.find((c) => c.id === input.changeRequestId)?.number ? `CR-${d.changeRequests.find((c) => c.id === input.changeRequestId)!.number}` : "change request"}` : ""}`, projectId)
    return ok(baselined ? "Milestone added under the approved change request." : "Milestone added. Its baseline freezes when the first estimate is approved.")
  })
}

export async function createOrganisation(name: string, code: string) {
  return guard(async () => {
    const admin = await requireAdmin()
    const c = code.trim().toUpperCase()
    if (name.trim().length < 2 || !/^[A-Z]{2,6}$/.test(c)) return fail("Give a name and a 2–6 letter code.")
    if (db().orgs.some((o) => o.code === c || o.name.toLowerCase() === name.trim().toLowerCase())) return fail("That organisation or code exists.")
    db().orgs.push({ id: newId("org"), name: name.trim(), kind: "client", code: c })
    audit(admin.id, "Organisation created", `${name.trim()} (${c})`, undefined, true)
    return ok("Client organisation created.")
  })
}

// ── Administrator ───────────────────────────────────────────────────────────
async function requireAdmin() {
  const u = await getViewer()
  if (!u || u.kind !== "admin") throw new Refused("Admins only.")
  return u
}

export async function inviteUser(input: { name: string; email: string; orgId: string; kind: UserKind; projectId?: string; workstreamId?: string }) {
  return guard(async () => {
    const admin = await requireAdmin()
    const d = db()
    if (!input.name.trim() || !/^\S+@\S+\.\S+$/.test(input.email)) return fail("Name and a valid email are required.")
    if (d.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) return fail("A user with that email exists.")
    const org = d.orgs.find((o) => o.id === input.orgId)
    if (!org) return fail("Choose an organisation.")
    const staffKind = ["admin", "director", "team"].includes(input.kind)
    if ((org.kind === "agency") !== staffKind) return fail("Role does not match the organisation side.")
    const u: User = { id: newId("u"), name: input.name.trim(), email: input.email.trim(), orgId: org.id, kind: input.kind, title: "", status: "invited" }
    d.users.push(u)
    if (input.projectId) {
      const p = d.projects.find((x) => x.id === input.projectId && (staffKind || x.clientOrgId === org.id))
      if (p) {
        const role = input.kind === "director" ? "director" : input.kind === "team" ? "team" : input.kind === "client_lead" ? "client_lead" : "client_stakeholder"
        d.memberships.push({ projectId: p.id, userId: u.id, role, workstreamIds: input.workstreamId ? [input.workstreamId] : [], publishRight: false, manageAccess: false, preset: role === "client_lead" ? "Approver" : "Workstream contributor" })
      }
    }
    audit(admin.id, "User invited", `${u.email} (${input.kind}) — invitation expires in 7 days, single-use`, input.projectId, true)
    return ok("Invitation sent (single-use, expires in 7 days).")
  })
}

export async function setUserStatus(userId: string, status: "active" | "deactivated") {
  return guard(async () => {
    const admin = await requireAdmin()
    const d = db()
    const u = d.users.find((x) => x.id === userId)
    if (!u || u.id === admin.id) return fail("Not allowed.")
    u.status = status
    if (status === "deactivated") {
      const flagged = d.approvals.filter((a) => a.state === "pending" && a.approverIds.includes(userId))
      flagged.forEach((a) => (a.unavailableApproverIds = [...new Set([...(a.unavailableApproverIds ?? []), userId])]))
      for (const a of flagged) notify({ userIds: [a.requestedBy], tier: 1, title: `Approver unavailable on "${a.title}" — reassign`, projectId: a.projectId, path: "/decisions" })
      audit(admin.id, "User deactivated", `${u.email}: sessions ended, signed links invalidated; ${flagged.length} pending approval(s) flagged`, undefined, true)
    } else audit(admin.id, "User reactivated", u.email, undefined, true)
    return ok(status === "deactivated" ? "Deactivated. Their next request is refused." : "Reactivated.")
  })
}

export async function adminSelfGrant(projectId: string) {
  return guard(async () => {
    const admin = await requireAdmin()
    const d = db()
    const p = d.projects.find((x) => x.id === projectId)
    if (!p) return fail("Not found.")
    if (d.memberships.some((m) => m.projectId === projectId && m.userId === admin.id)) return fail("Already granted.")
    d.memberships.push({ projectId, userId: admin.id, role: "team", workstreamIds: [], publishRight: false, manageAccess: false, preset: "View only", selfGranted: true })
    audit(admin.id, "SECURITY: admin self-grant", `${admin.name} granted themselves View-only access to ${p.code}`, projectId, true)
    notify({ userIds: directors(projectId), tier: 1, title: `Security alert: ${admin.name} self-granted access to ${p.name}`, projectId, path: "/history" })
    return ok("Self-grant recorded. The CEO has been alerted.")
  })
}
