// Core domain model for CtrlPMS. Pure types — shared by server and client code.

export type ISODate = string // "2026-11-03" (date only, project timezone)
export type ISODateTime = string // full ISO timestamp, stored in UTC

export type OrgKind = "agency" | "client"
export interface Org {
  id: string
  name: string
  kind: OrgKind
  /** Short prefix used in generated project IDs, e.g. GERA-2026-001. */
  code: string
  primaryContactId?: string
}

export type UserKind =
  | "admin"
  | "director"
  | "team"
  | "exec"
  | "client_lead"
  | "client_stakeholder"

export interface User {
  id: string
  name: string
  email: string
  orgId: string
  kind: UserKind
  title: string
  status: "active" | "invited" | "deactivated"
  /** Shown under "More test users" in the dev role switcher. */
  extra?: boolean
}

export type Lifecycle =
  | "setup"
  | "proposal"
  | "active"
  | "paused"
  | "closing"
  | "closed"
  | "cancelled"
  | "archived"

export interface Workstream {
  id: string
  projectId: string
  name: string
}

export interface Project {
  id: string
  code: string
  name: string
  clientOrgId: string
  ownerId: string
  lifecycle: Lifecycle
  objectives: string
  scope: string
  timezone: string
  currency: string
  plannedStart: ISODate
  targetEnd: ISODate
  pause?: { reason: string; at: ISODateTime; by: string }
  cancelRequest?: { reason: string; at: ISODateTime; by: string }
  closure?: Closure
  /** Closure records from earlier cycles, preserved when a project is reopened (REQ-PRJ-06). */
  previousClosures?: Closure[]
}

export type ClosureKey = "deliverables" | "final_docs" | "feedback" | "actions" | "final_status"

export interface ClosureItem {
  key: ClosureKey
  label: string
  state: "pending" | "met" | "waived"
  waiverReason?: string
  by?: string
  at?: ISODateTime
}

export interface Survey {
  overall: number
  usefulness: number
  clarity: number
  timeline: number
  responsiveness: number
  comments: string
  by: string
  at: ISODateTime
}

export interface Closure {
  startedAt: ISODateTime
  startedBy: string
  items: ClosureItem[]
  finalApprovalId?: string
  survey?: Survey | { skipped: true; by: string; at: ISODateTime }
  /** Once set, the closure record is immutable (REQ-CLS-03). */
  finalizedAt?: ISODateTime
  finalizedBy?: string
}

export type ProjectRole = "owner" | "director" | "team" | "client_lead" | "client_stakeholder"

export interface Membership {
  projectId: string
  userId: string
  role: ProjectRole
  workstreamIds: string[]
  publishRight: boolean
  manageAccess: boolean
  preset: AccessPreset
  /** Granted by an administrator to themselves (security event). */
  selfGranted?: boolean
}

export type AccessPreset =
  | "View only"
  | "Collaborator"
  | "Workstream contributor"
  | "Approver"
  | "Full project access"
  | "Custom"

// ── The 5-tier audience model ────────────────────────────────────────────────
export type Audience =
  | { kind: "draft" }
  | { kind: "team" }
  | { kind: "workstream"; workstreamId: string }
  | { kind: "named"; userIds: string[] }
  | { kind: "client" }

/** Anything that carries an audience. */
export interface Audienced {
  id: string
  projectId: string
  audience: Audience
  authorId: string
}

export type Health = "on_track" | "at_risk" | "delayed"

export interface StatusStatement {
  id: string
  projectId: string
  text: string
  health: Health
  explanation?: string
  nextSteps: string
  authorId: string
  at: ISODateTime
}

export interface Phase {
  id: string
  projectId: string
  name: string
  order: number
}

export type MilestoneState =
  | "planned"
  | "in_progress"
  | "ready_for_review"
  | "changes_requested"
  | "accepted"
  | "dropped"

export type DateLinkKind = "blocker" | "change_request" | "team_adjustment"

export interface DateChange {
  from: ISODate
  to: ISODate
  reason: string
  linkKind: DateLinkKind
  linkId?: string
  at: ISODateTime
  by: string
}

export interface Milestone extends Audienced {
  phaseId: string
  name: string
  description: string
  ownerId: string
  counterpartId?: string
  acceptance: "client" | "internal"
  criteria: string
  baselineDate?: ISODate
  currentDate: ISODate
  state: MilestoneState
  dateChanges: DateChange[]
  acceptedAt?: ISODateTime
}

export type BlockerType = "client decision" | "client input" | "third party" | "internal"

export interface Blocker extends Audienced {
  reason: string
  type: BlockerType
  responsibleId: string
  raisedAt: ISODateTime
  expectedResolution: ISODate
  milestoneIds: string[]
  resolvedAt?: ISODateTime
}

export interface ActionItem extends Audienced {
  description: string
  ownerId: string
  due?: ISODate
  source?: { kind: "publication" | "comment" | "manual"; id?: string; label: string }
  state: "open" | "done" | "cancelled"
  createdAt: ISODateTime
}

/** Hours a staff member worked on a project. Clients only ever see totals. */
export interface TimeEntry {
  id: string
  projectId: string
  userId: string
  date: ISODate
  hours: number
  note: string
  createdAt: ISODateTime
}

export interface DocVersion {
  n: number
  fileName: string
  sizeKb: number
  changeNote: string
  uploadedAt: ISODateTime
  uploadedBy: string
}

export interface DocumentItem extends Audienced {
  title: string
  /** "commercial" files belong to an estimate and are shown only with it. */
  kind: "deliverable" | "working" | "reference" | "commercial"
  phaseId?: string
  versions: DocVersion[]
  publishedAt?: ISODateTime
  retracted?: { reason: string; at: ISODateTime; by: string }
}

export interface Publication extends Audienced {
  kind: "meeting" | "update" | "deliverable"
  title: string
  meetingAt?: ISODateTime
  publishedAt?: ISODateTime
  createdAt: ISODateTime
  summary: string
  attendeeIds: string[]
  decisionIds: string[]
  actionIds: string[]
  attachments: { documentId: string; version: number }[]
  /** Morphoverse-only remarks: never rendered, searched or exported for client users. */
  teamRemarks?: string
  actionRequired: boolean
  state: "draft" | "published"
  version: number
  changeNote?: string
  supersedesId?: string
  supersededById?: string
  retracted?: { reason: string; at: ISODateTime; by: string }
}

export interface Decision extends Audienced {
  statement: string
  context?: string
  partyIds: string[]
  date: ISODate
  sourcePublicationId?: string
  sourceChangeRequestId?: string
  state: "active" | "under_revisit" | "superseded"
  supersededById?: string
}

export type ApprovalOutcome = "approve" | "changes" | "decline"
export type ApprovalState =
  | "pending"
  | "approved"
  | "changes_requested"
  | "declined"
  | "withdrawn"
  | "superseded"

export type ApprovalSubject =
  | { kind: "estimate"; id: string; version: number }
  | { kind: "milestone"; id: string }
  | { kind: "document"; id: string; version: number }
  | { kind: "change_request"; id: string }
  | { kind: "final"; projectId: string }

export interface ApprovalResponse {
  userId: string
  outcome: ApprovalOutcome
  comment: string
  at: ISODateTime
  method: string
}

export interface ApprovalRequest {
  id: string
  projectId: string
  title: string
  subject: ApprovalSubject
  tier: "A" | "B"
  approverIds: string[]
  rule: "all" | "any"
  due: ISODate
  state: ApprovalState
  responses: ApprovalResponse[]
  requestedBy: string
  createdAt: ISODateTime
  withdrawnReason?: string
  external?: { evidence: string; recordedBy: string }
  unavailableApproverIds?: string[]
}

export type EstimateState =
  | "draft"
  | "internal_review"
  | "shared"
  | "approved"
  | "declined"
  | "expired"
  | "withdrawn"
  | "superseded"

export interface LineItem {
  id: string
  label: string
  qty: number
  unit: string
  rate: number
}

export interface Estimate {
  id: string
  projectId: string
  version: number
  state: EstimateState
  scope: string
  deliverables: string[]
  effortDays: number
  durationWeeks: number
  lineItems: LineItem[]
  expenses: number
  taxRate: number
  assumptions: string[]
  exclusions: string[]
  validUntil: ISODate
  detailLevel: "line_items" | "total"
  /** Internal cost assumptions — never exposed to client users. */
  internal: { costPerDay: number; targetMarginPct: number; notes: string }
  createdAt: ISODateTime
  createdBy: string
  sharedAt?: ISODateTime
  approvedAt?: ISODateTime
  /** Supporting files (rate card, pricing rationale…). Visible exactly where the estimate is. */
  attachmentIds: string[]
  /** Milestone current dates captured when the version was shared. */
  scheduleSnapshot: { milestoneId: string; name: string; date: ISODate }[]
}

export type ChangeCategory = "revisit decision" | "change date" | "change scope" | "other"
export type ChangeState =
  | "submitted"
  | "under_review"
  | "needs_clarification"
  | "impact_review"
  | "awaiting_client_approval"
  | "approved"
  | "implemented"
  | "declined"
  | "withdrawn"

export interface ImpactReview {
  milestoneIds: string[]
  dateShiftDays: number
  scope: string
  effortDays: number
  costDelta: number
  needsClientApproval: boolean
  at: ISODateTime
  by: string
}

export interface ChangeRequest extends Audienced {
  number: number
  category: ChangeCategory
  what: string
  why: string
  timing: string
  submittedAt: ISODateTime
  state: ChangeState
  linkedDecisionId?: string
  clarification?: { question: string; answer?: string }
  declineReason?: string
  impact?: ImpactReview
  approvalId?: string
}

export interface Comment {
  id: string
  authorId: string
  body: string
  at: ISODateTime
  editedAt?: ISODateTime
}

export interface Thread {
  id: string
  projectId: string
  subject: { kind: "publication" | "document"; id: string }
  /** Shared = visible to the item's audience. Team = Morphoverse only. */
  audience: "shared" | "team"
  purpose: "discussion" | "correction"
  comments: Comment[]
  resolved: boolean
}

export interface AuditEntry {
  id: string
  projectId?: string
  at: ISODateTime
  actorId: string
  action: string
  detail: string
  security?: boolean
}

export interface Notification {
  id: string
  userId: string
  tier: 1 | 2
  title: string
  href: string
  at: ISODateTime
  read: boolean
  projectId?: string
}

export interface Email {
  id: string
  to: string
  userId: string
  tier: 1 | 2
  subject: string
  link: string
  at: ISODateTime
  status: "sent" | "queued_digest" | "sent_in_digest"
}

export interface AccessRequest {
  id: string
  projectId: string
  documentId: string
  userId: string
  reason: string
  state: "pending" | "granted" | "declined"
  at: ISODateTime
  decidedBy?: string
}
