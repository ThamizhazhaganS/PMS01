// Pure business rules and derived values. Never store what can be derived.
import type {
  ApprovalRequest,
  Estimate,
  Health,
  Lifecycle,
  Milestone,
  MilestoneState,
  Phase,
  StatusStatement,
  UserKind,
} from "./types"

export const DEFAULT_PHASES = [
  "Initiation",
  "Discovery & Alignment",
  "Planning & Scope Approval",
  "Execution",
  "Review & Feedback",
  "Revisions & Validation",
  "Final Approval",
  "Closure",
] as const

export const STALE_DAYS = 14

export const CLOSURE_ITEMS = [
  ["deliverables", "All client deliverables accepted"],
  ["final_docs", "Final documents published"],
  ["feedback", "Client feedback recorded"],
  ["actions", "Open actions resolved or transferred"],
  ["final_status", "Final status statement written"],
] as const

export const SURVEY_QUESTIONS = [
  ["overall", "Overall satisfaction"],
  ["usefulness", "Usefulness of deliverables"],
  ["clarity", "Clarity of communication"],
  ["timeline", "Keeping to the timeline"],
  ["responsiveness", "Responsiveness"],
] as const
export const DEV_OTP = "123456"
export const MIN_REASON = 10

export const HEALTH_LABEL: Record<Health, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  delayed: "Delayed",
}

export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  setup: "Setup",
  proposal: "Proposal",
  active: "Active",
  paused: "Paused",
  closing: "Closing",
  closed: "Closed",
  cancelled: "Cancelled",
  archived: "Archived",
}

export const MILESTONE_LABEL: Record<MilestoneState, string> = {
  planned: "Planned",
  in_progress: "In progress",
  ready_for_review: "Ready for review",
  changes_requested: "Changes requested",
  accepted: "Accepted",
  dropped: "Dropped",
}

export const ROLE_LABEL: Record<UserKind, string> = {
  admin: "Admin",
  director: "Director",
  team: "Team Member",
  exec: "Executive Director",
  client_lead: "Client Lead",
  client_stakeholder: "Client Stakeholder",
}

export const isStaffKind = (k: UserKind) => k === "admin" || k === "director" || k === "team"
export const isClientKind = (k: UserKind) => !isStaffKind(k)

// ── Derived values ──────────────────────────────────────────────────────────
export function estimateTotals(e: Pick<Estimate, "lineItems" | "expenses" | "taxRate">) {
  const fees = e.lineItems.reduce((s, li) => s + li.qty * li.rate, 0)
  const subtotal = fees + e.expenses
  const tax = Math.round((subtotal * e.taxRate) / 100)
  return { fees, subtotal, tax, total: subtotal + tax }
}

export function progress(milestones: Milestone[]) {
  const counted = milestones.filter((m) => m.state !== "dropped")
  return { accepted: counted.filter((m) => m.state === "accepted").length, total: counted.length }
}

export function phaseStatus(phase: Phase, milestones: Milestone[]): "Not started" | "In progress" | "Complete" {
  const ms = milestones.filter((m) => m.phaseId === phase.id && m.state !== "dropped")
  if (ms.length === 0) return "Not started"
  if (ms.every((m) => m.state === "accepted")) return "Complete"
  if (ms.some((m) => m.state !== "planned")) return "In progress"
  return "Not started"
}

export function nextMilestone(milestones: Milestone[]) {
  return [...milestones]
    .filter((m) => m.state !== "accepted" && m.state !== "dropped")
    .sort((a, b) => a.currentDate.localeCompare(b.currentDate))[0]
}

export function expectedCompletion(milestones: Milestone[]) {
  const dates = milestones.filter((m) => m.state !== "dropped").map((m) => m.currentDate).sort()
  return dates[dates.length - 1]
}

export function todayIso() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b.slice(0, 10)).getTime() - new Date(a.slice(0, 10)).getTime()) / 86_400_000)
}

export function isStale(s?: StatusStatement) {
  if (!s) return true
  return daysBetween(s.at, todayIso()) > STALE_DAYS
}

export function isOverdue(a: ApprovalRequest, lifecycle?: Lifecycle) {
  return a.state === "pending" && lifecycle !== "paused" && a.due < todayIso()
}

export function slipDays(m: Milestone) {
  return m.baselineDate ? daysBetween(m.baselineDate, m.currentDate) : 0
}

// ── Formatting (IST, INR) ────────────────────────────────────────────────────
const TZ = "Asia/Kolkata"
export const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T12:00:00+05:30` : iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: TZ,
      })
    : "—"
export const fmtShort = (iso?: string) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T12:00:00+05:30` : iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: TZ,
      })
    : "—"
export const fmtDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: TZ,
      }) + " IST"
    : "—"
export const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

export function relDays(iso: string) {
  const n = daysBetween(iso, todayIso())
  if (n === 0) return "today"
  if (n === 1) return "yesterday"
  if (n === -1) return "tomorrow"
  return n > 0 ? `${n} days ago` : `in ${-n} days`
}
