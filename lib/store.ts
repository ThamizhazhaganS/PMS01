import "server-only"
import type {
  AccessRequest,
  ActionItem,
  ApprovalRequest,
  AuditEntry,
  Blocker,
  ChangeRequest,
  Decision,
  DocumentItem,
  Email,
  Estimate,
  Membership,
  Milestone,
  Notification,
  Org,
  Phase,
  Project,
  Publication,
  StatusStatement,
  Thread,
  User,
  Workstream,
} from "@/lib/domain/types"
import { seed } from "@/lib/mock/seed"

/**
 * In-memory database for Stage 1. Lives on the server only, so every read goes
 * through the audience-filtered queries in lib/data. Stage 2 swaps this for Prisma.
 */
export interface DB {
  orgs: Org[]
  users: User[]
  projects: Project[]
  workstreams: Workstream[]
  memberships: Membership[]
  statuses: StatusStatement[]
  phases: Phase[]
  milestones: Milestone[]
  blockers: Blocker[]
  actions: ActionItem[]
  documents: DocumentItem[]
  publications: Publication[]
  decisions: Decision[]
  approvals: ApprovalRequest[]
  estimates: Estimate[]
  changeRequests: ChangeRequest[]
  threads: Thread[]
  audit: AuditEntry[]
  notifications: Notification[]
  emails: Email[]
  accessRequests: AccessRequest[]
  digestOptOut: Record<string, boolean>
  seq: number
}

const g = globalThis as unknown as { __ppdb?: DB }

export function db(): DB {
  if (!g.__ppdb) g.__ppdb = seed()
  return g.__ppdb
}

export function resetDb() {
  g.__ppdb = seed()
}

export function newId(prefix: string) {
  const d = db()
  d.seq += 1
  return `${prefix}-${d.seq}`
}

export const nowIso = () => new Date().toISOString()
