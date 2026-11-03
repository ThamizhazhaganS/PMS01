// The permission core. Pure functions: the server uses them to filter every
// query, notification and download; the client reuses them only to *preview*
// recipients — never as the control.
import type { Audience, Membership, Project, User } from "@/lib/domain/types"
import { isStaffKind } from "@/lib/domain/rules"

export interface AccessCtx {
  user: User
  project: Project
  membership?: Membership
}

export type ItemKind =
  | "status"
  | "milestone"
  | "blocker"
  | "action"
  | "document"
  | "publication"
  | "decision"
  | "approval"
  | "estimate"
  | "change_request"
  | "thread"
  | "audit"

export const isStaff = (u: User) => isStaffKind(u.kind)
export const isClient = (u: User) => !isStaffKind(u.kind)

/** Executive Director oversight: every project of their own organisation. */
export const isExecOverseer = (ctx: AccessCtx) =>
  ctx.user.kind === "exec" && ctx.user.orgId === ctx.project.clientOrgId

/** REQ-ACC-02: membership reveals only the project shell. */
export function hasShell(ctx: AccessCtx): boolean {
  if (ctx.user.status !== "active") return false
  if (isClient(ctx.user)) {
    if (ctx.user.orgId !== ctx.project.clientOrgId) return false // NFR-02
    if (ctx.project.lifecycle === "setup") return false // T-03
    return !!ctx.membership || isExecOverseer(ctx)
  }
  return !!ctx.membership
}

/** Clients in Proposal see only the shared estimate (T-03). */
function lifecycleAllows(ctx: AccessCtx, kind: ItemKind) {
  if (isStaff(ctx.user)) return true
  if (ctx.project.lifecycle === "proposal") return kind === "estimate" || kind === "approval" || kind === "status"
  return true
}

export function canSeeAudience(ctx: AccessCtx, audience: Audience, authorId: string, kind: ItemKind = "document"): boolean {
  if (!hasShell(ctx)) return false
  if (!lifecycleAllows(ctx, kind)) return false
  const staff = isStaff(ctx.user)
  const ms = ctx.membership
  switch (audience.kind) {
    case "draft":
      return authorId === ctx.user.id
    case "team":
      return staff
    case "workstream":
      if (isExecOverseer(ctx)) return true
      if (ms?.role === "owner") return true
      return !!ms?.workstreamIds.includes(audience.workstreamId)
    case "named":
      return audience.userIds.includes(ctx.user.id) || (authorId === ctx.user.id && staff)
    case "client":
      return true
  }
}

/** Named items: non-listed project members see metadata only ("Restricted item"). */
export function isRestrictedStub(ctx: AccessCtx, audience: Audience, authorId: string, kind: ItemKind = "document") {
  return audience.kind === "named" && hasShell(ctx) && lifecycleAllows(ctx, kind) && !canSeeAudience(ctx, audience, authorId, kind)
}

// ── Capabilities (project scope) ────────────────────────────────────────────
const role = (ctx: AccessCtx) => (hasShell(ctx) ? ctx.membership?.role : undefined)
export const isOwner = (ctx: AccessCtx) => role(ctx) === "owner"
export const isProjectDirector = (ctx: AccessCtx) => role(ctx) === "owner" || role(ctx) === "director"
// Administrators never get working rights from a self-grant (view only).
export const isProjectStaff = (ctx: AccessCtx) => isStaff(ctx.user) && ctx.user.kind !== "admin" && !!role(ctx)
export const canPublish = (ctx: AccessCtx) =>
  isProjectDirector(ctx) || (role(ctx) === "team" && !!ctx.membership?.publishRight)
export const canManageAccess = (ctx: AccessCtx) => isOwner(ctx) || (isProjectDirector(ctx) && !!ctx.membership?.manageAccess)
export const canSeeCommercial = (ctx: AccessCtx) =>
  hasShell(ctx) && (isProjectStaff(ctx) || role(ctx) === "client_lead" || isExecOverseer(ctx))
export const canViewInternalCost = (ctx: AccessCtx) => isProjectStaff(ctx)
export const canTriage = isOwner
export const canViewAs = isProjectDirector
export const canSubmitChange = (ctx: AccessCtx) => hasShell(ctx) && ctx.user.kind !== "admin"

// ── Recipient preview for deliberate publishing (REQ-PUB-01) ────────────────
export interface MemberLite {
  user: User
  membership?: Membership
}

export function recipientsFor(project: Project, audience: Audience, authorId: string, people: MemberLite[]) {
  return people.filter((p) =>
    canSeeAudience({ user: p.user, project: { ...project, lifecycle: project.lifecycle === "setup" ? "active" : project.lifecycle }, membership: p.membership }, audience, authorId),
  )
}

export function audienceLabel(a: Audience, wsName?: (id: string) => string) {
  switch (a.kind) {
    case "draft":
      return "Draft"
    case "team":
      return "Team"
    case "workstream":
      return wsName ? `Workstream · ${wsName(a.workstreamId)}` : "Workstream"
    case "named":
      return `Named · ${a.userIds.length}`
    case "client":
      return "Client-wide"
  }
}

/** Order used for "widening" checks (REQ-ACC-10). */
export const audienceBreadth = (a: Audience) =>
  ({ draft: 0, team: 1, named: 2, workstream: 3, client: 4 })[a.kind]
