import type { DB } from "@/lib/store"
import type {
  Audience,
  Membership,
  Milestone,
  Phase,
  ProjectRole,
} from "@/lib/domain/types"
import { DEFAULT_PHASES } from "@/lib/domain/rules"

// Seed dates are relative to "today" so staleness, overdue flags and the
// 14-day rule stay meaningful whenever the dev server starts.
const DAY = 86_400_000
const today = () => new Date()
export const d = (offset: number): string =>
  new Date(today().getTime() + offset * DAY).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  })
const dt = (offset: number, hour = 11, minute = 0): string => {
  const base = d(offset)
  // hour/minute are IST; convert to UTC (IST = UTC+5:30)
  const utc = new Date(`${base}T00:00:00Z`).getTime() + (hour * 60 + minute - 330) * 60_000
  return new Date(utc).toISOString()
}

const CLIENT: Audience = { kind: "client" }
const TEAM: Audience = { kind: "team" }
const ws = (id: string): Audience => ({ kind: "workstream", workstreamId: id })

function phasesFor(projectId: string): Phase[] {
  return DEFAULT_PHASES.map((name, i) => ({ id: `${projectId}-ph${i + 1}`, projectId, name, order: i + 1 }))
}

function member(
  projectId: string,
  userId: string,
  role: ProjectRole,
  workstreamIds: string[],
  extra: Partial<Membership> = {},
): Membership {
  const staff = role === "owner" || role === "director" || role === "team"
  return {
    projectId,
    userId,
    role,
    workstreamIds,
    publishRight: role === "owner" || role === "director",
    manageAccess: role === "owner",
    preset:
      role === "owner"
        ? "Full project access"
        : role === "client_lead"
          ? "Approver"
          : staff
            ? "Collaborator"
            : "Workstream contributor",
    ...extra,
  }
}

export function seed(): DB {
  const db: DB = {
    orgs: [
      { id: "org-morph", name: "Morphoverse", kind: "agency", code: "MV" },
      { id: "org-nova", name: "Gera Development", kind: "client", code: "GERA", primaryContactId: "u-gulzer" },
      { id: "org-helix", name: "Helix Retail", kind: "client", code: "HLX", primaryContactId: "u-emma" },
    ],
    users: [
      { id: "u-admin", name: "Shrenik", email: "shrenik.admin@morphoverse.com", orgId: "org-morph", kind: "admin", title: "Admin", status: "active" },
      { id: "u-tashi", name: "Tashi", email: "tashi@morphoverse.com", orgId: "org-morph", kind: "director", title: "CEO", status: "active" },
      { id: "u-sanjeev", name: "Sanjeev", email: "sanjeev@morphoverse.com", orgId: "org-morph", kind: "team", title: "Team Member", status: "active" },
      { id: "u-shrenik-team", name: "Shrenik", email: "shrenik@morphoverse.com", orgId: "org-morph", kind: "team", title: "Team Member", status: "active" },
      { id: "u-priyanka", name: "Priyanka", email: "priyanka@morphoverse.com", orgId: "org-morph", kind: "team", title: "Team Member", status: "active" },
      { id: "u-rohit", name: "Rohit Gera", email: "rohit.gera@geradevelopment.com", orgId: "org-nova", kind: "exec", title: "Executive Director", status: "active" },
      { id: "u-gulzer", name: "Gulzer", email: "gulzer@geradevelopment.com", orgId: "org-nova", kind: "client_lead", title: "Client Lead", status: "active" },
      { id: "u-diva", name: "Diva", email: "diva@geradevelopment.com", orgId: "org-nova", kind: "client_stakeholder", title: "Client Stakeholder (HR)", status: "active" },
      // More test users
      { id: "u-arjun", name: "Arjun Nair", email: "arjun.nair@geradevelopment.com", orgId: "org-nova", kind: "client_stakeholder", title: "IT Infrastructure Lead", status: "active", extra: true },
      { id: "u-emma", name: "Emma Brooks", email: "emma.brooks@helixretail.com", orgId: "org-helix", kind: "client_lead", title: "COO, Helix Retail", status: "active", extra: true },
    ],
    projects: [
      {
        id: "p1",
        code: "GERA-2026-001",
        name: "HR & IT Operating Model Redesign",
        clientOrgId: "org-nova",
        ownerId: "u-tashi",
        lifecycle: "active",
        objectives: "Design a target operating model for HR shared services and IT service management across Gera's three Pune plants.",
        scope: "Current-state assessment, HR target operating model, IT systems blueprint, consolidated recommendations and roadmap.",
        timezone: "Asia/Kolkata",
        currency: "INR",
        plannedStart: d(-75),
        targetEnd: d(60),
      },
      {
        id: "p2",
        code: "GERA-2026-002",
        name: "Procurement Cost Optimisation",
        clientOrgId: "org-nova",
        ownerId: "u-tashi",
        lifecycle: "proposal",
        objectives: "Identify ₹4–6 Cr of addressable savings across indirect procurement categories.",
        scope: "Spend cube, category deep-dives (logistics, MRO, IT), negotiation playbooks.",
        timezone: "Asia/Kolkata",
        currency: "INR",
        plannedStart: d(14),
        targetEnd: d(110),
      },
      {
        id: "p3",
        code: "GERA-2026-003",
        name: "Plant Safety Digital Audit",
        clientOrgId: "org-nova",
        ownerId: "u-tashi",
        lifecycle: "paused",
        objectives: "Digitise the plant safety audit process and benchmark against ISO 45001.",
        scope: "Audit process mapping, tool selection, two-plant pilot.",
        timezone: "Asia/Kolkata",
        currency: "INR",
        plannedStart: d(-60),
        targetEnd: d(40),
        pause: { reason: "Site access for Chakan plant suspended during annual maintenance shutdown.", at: dt(-20), by: "u-tashi" },
      },
      {
        id: "p5",
        code: "GERA-2026-004",
        name: "Supplier Code of Conduct Review",
        clientOrgId: "org-nova",
        ownerId: "u-tashi",
        lifecycle: "active",
        objectives: "Refresh Gera's supplier code of conduct and onboarding checks.",
        scope: "Benchmark, revised code, supplier onboarding checklist.",
        timezone: "Asia/Kolkata",
        currency: "INR",
        plannedStart: d(-55),
        targetEnd: d(-2),
      },
      {
        id: "p4",
        code: "HLX-2026-001",
        name: "Store Network Expansion Review",
        clientOrgId: "org-helix",
        ownerId: "u-tashi",
        lifecycle: "active",
        objectives: "Assess 40 candidate locations for Helix's 2027 store expansion.",
        scope: "Catchment analysis, site scoring model, board recommendation.",
        timezone: "Asia/Kolkata",
        currency: "INR",
        plannedStart: d(-30),
        targetEnd: d(50),
      },
    ],
    workstreams: [
      { id: "ws-hr", projectId: "p1", name: "HR Transformation" },
      { id: "ws-it", projectId: "p1", name: "IT Systems" },
      { id: "ws-p2", projectId: "p2", name: "Procurement" },
      { id: "ws-p3", projectId: "p3", name: "Plant Safety" },
      { id: "ws-p4", projectId: "p4", name: "Network Planning" },
      { id: "ws-p5", projectId: "p5", name: "Supplier Governance" },
    ],
    memberships: [
      member("p1", "u-tashi", "owner", ["ws-hr", "ws-it"]),
      member("p1", "u-sanjeev", "team", ["ws-hr", "ws-it"], { publishRight: true }),
      member("p1", "u-shrenik-team", "team", ["ws-hr"]),
      member("p1", "u-priyanka", "team", ["ws-hr", "ws-it"], { publishRight: true }),
      member("p1", "u-gulzer", "client_lead", ["ws-hr", "ws-it"]),
      member("p1", "u-diva", "client_stakeholder", ["ws-hr"]),
      member("p1", "u-arjun", "client_stakeholder", ["ws-it"]),
      member("p2", "u-tashi", "owner", ["ws-p2"]),
      member("p2", "u-sanjeev", "team", ["ws-p2"], { publishRight: true }),
      member("p2", "u-gulzer", "client_lead", ["ws-p2"]),
      member("p3", "u-tashi", "owner", ["ws-p3"]),
      member("p3", "u-shrenik-team", "team", ["ws-p3"]),
      member("p3", "u-gulzer", "client_lead", ["ws-p3"]),
      member("p3", "u-diva", "client_stakeholder", ["ws-p3"]),
      member("p5", "u-tashi", "owner", ["ws-p5"]),
      member("p5", "u-sanjeev", "team", ["ws-p5"], { publishRight: true }),
      member("p5", "u-priyanka", "team", ["ws-p5"]),
      member("p5", "u-gulzer", "client_lead", ["ws-p5"]),
      member("p4", "u-tashi", "owner", ["ws-p4"]),
      member("p4", "u-emma", "client_lead", ["ws-p4"]),
    ],
    statuses: [
      {
        id: "st-1",
        projectId: "p1",
        text: "HR operating model is ready for Gulzer's review. IT blueprint is running about ten days behind because the asset inventory export from Gera IT has not arrived yet.",
        health: "at_risk",
        explanation: "IT Systems Blueprint depends on the asset inventory export (blocker B-1). If received this week we can recover most of the slip.",
        nextSteps: "Walk Gulzer through the HR TOM on Thursday; finalise role-mapping workbook; chase IT export.",
        authorId: "u-tashi",
        at: dt(-5, 18),
      },
      {
        id: "st-0",
        projectId: "p1",
        text: "Discovery complete and scope approved. Execution has started on both workstreams.",
        health: "on_track",
        nextSteps: "HR workshops with Diva's team; IT landscape interviews.",
        authorId: "u-tashi",
        at: dt(-26, 17),
      },
      {
        id: "st-2",
        projectId: "p2",
        text: "Proposal v1 shared with Gulzer for approval. Kick-off can begin within a week of approval.",
        health: "on_track",
        nextSteps: "Answer Gulzer's questions on the MRO category scope.",
        authorId: "u-tashi",
        at: dt(-6, 12),
      },
      {
        id: "st-3",
        projectId: "p3",
        text: "Project paused while the Chakan plant is in its maintenance shutdown.",
        health: "delayed",
        explanation: "Site access unavailable; pilot cannot start until the plant reopens.",
        nextSteps: "Confirm reopening date with Gera facilities.",
        authorId: "u-tashi",
        at: dt(-21, 10),
      },
      {
        id: "st-5",
        projectId: "p5",
        text: "Revised supplier code accepted by Gulzer. Remaining work is handover.",
        health: "on_track",
        nextSteps: "Prepare closure: final pack, handover of the onboarding checklist.",
        authorId: "u-tashi",
        at: dt(-4, 11),
      },
      {
        id: "st-4",
        projectId: "p4",
        text: "Catchment analysis complete for 28 of 40 sites.",
        health: "on_track",
        nextSteps: "Finish remaining sites; draft scoring model.",
        authorId: "u-tashi",
        at: dt(-3, 16),
      },
    ],
    phases: [...phasesFor("p1"), ...phasesFor("p2"), ...phasesFor("p3"), ...phasesFor("p4"), ...phasesFor("p5")],
    milestones: [],
    blockers: [],
    actions: [],
    documents: [],
    publications: [],
    decisions: [],
    approvals: [],
    estimates: [],
    changeRequests: [],
    threads: [],
    audit: [],
    notifications: [],
    emails: [],
    accessRequests: [],
    digestOptOut: {},
    seq: 1000,
  }

  // ── Milestones ────────────────────────────────────────────────────────────
  const m = (
    id: string,
    projectId: string,
    phase: number,
    name: string,
    o: Partial<Milestone> & { base: number; cur?: number },
  ): Milestone => ({
    id,
    projectId,
    phaseId: `${projectId}-ph${phase}`,
    name,
    description: o.description ?? "",
    ownerId: o.ownerId ?? "u-tashi",
    counterpartId: o.counterpartId,
    acceptance: o.acceptance ?? "client",
    criteria: o.criteria ?? "",
    baselineDate: o.baselineDate === undefined ? d(o.base) : o.baselineDate,
    currentDate: d(o.cur ?? o.base),
    state: o.state ?? "planned",
    dateChanges: o.dateChanges ?? [],
    acceptedAt: o.acceptedAt,
    audience: o.audience ?? CLIENT,
    authorId: o.ownerId ?? "u-tashi",
  })

  db.milestones.push(
    m("m1", "p1", 1, "Engagement kick-off & charter", { base: -70, acceptance: "internal", state: "accepted", acceptedAt: dt(-70), description: "Charter agreed and governance cadence set." }),
    m("m2", "p1", 2, "Current-state assessment report", { base: -45, state: "accepted", acceptedAt: dt(-44), counterpartId: "u-gulzer", criteria: "Covers all three plants; validated with HR and IT heads.", ownerId: "u-sanjeev" }),
    m("m3", "p1", 3, "Scope & plan approval", { base: -38, state: "accepted", acceptedAt: dt(-38), counterpartId: "u-gulzer", criteria: "Steering committee sign-off on scope." }),
    m("m4", "p1", 4, "HR target operating model", { base: 2, state: "ready_for_review", audience: ws("ws-hr"), counterpartId: "u-gulzer", criteria: "Service catalogue, org design and RACI for HR shared services.", ownerId: "u-sanjeev" }),
    m("m5", "p1", 4, "IT systems landscape blueprint", {
      base: 6,
      cur: 16,
      state: "in_progress",
      audience: ws("ws-it"),
      counterpartId: "u-arjun",
      criteria: "Application map, integration view and ITSM tool recommendation.",
      ownerId: "u-sanjeev",
      dateChanges: [{ from: d(6), to: d(16), reason: "Asset inventory export from Gera IT not yet received; blueprint cannot be validated without it.", linkKind: "blocker", linkId: "b1", at: dt(-4, 15), by: "u-tashi" }],
    }),
    m("m6", "p1", 4, "Role-mapping workbook", { base: 18, audience: ws("ws-hr"), counterpartId: "u-diva", criteria: "All 214 HR roles mapped to the new structure.", ownerId: "u-shrenik-team" }),
    m("m7", "p1", 5, "Consolidated recommendations", { base: 32, counterpartId: "u-gulzer", criteria: "Single recommendation pack across HR and IT with business case." }),
    m("m8", "p1", 7, "Final report sign-off", { base: 50, counterpartId: "u-gulzer", criteria: "Steering committee accepts final report." }),
    m("m9", "p1", 8, "Closure & handover", { base: 58, acceptance: "internal" }),
    // P2 — proposal: baselines not yet frozen
    m("m21", "p2", 2, "Spend cube & baseline", { base: 30, baselineDate: undefined, criteria: "12 months of indirect spend classified." }),
    m("m22", "p2", 4, "Category deep-dives", { base: 70, baselineDate: undefined, criteria: "Logistics, MRO, IT categories." }),
    m("m23", "p2", 7, "Savings plan sign-off", { base: 105, baselineDate: undefined, criteria: "Signed-off savings plan." }),
    // P3 — paused
    m("m31", "p3", 2, "Audit process map", { base: -30, state: "accepted", acceptedAt: dt(-29), ownerId: "u-tashi", criteria: "As-is audit process for both plants." }),
    m("m32", "p3", 4, "Two-plant digital pilot", { base: 10, state: "in_progress", ownerId: "u-shrenik-team", criteria: "Pilot runs for 4 weeks at Chakan and Ranjangaon." }),
    // P4 — Helix
    m("m51", "p5", 2, "Supplier code benchmark", { base: -30, state: "accepted", acceptedAt: dt(-29), criteria: "Benchmark against 5 peers.", ownerId: "u-sanjeev" }),
    m("m52", "p5", 7, "Revised code of conduct", { base: -6, state: "accepted", acceptedAt: dt(-5), criteria: "Approved by Gera legal and procurement.", ownerId: "u-tashi" }),
    m("m53", "p5", 8, "Onboarding checklist handover", { base: -3, acceptance: "internal", state: "accepted", acceptedAt: dt(-3), ownerId: "u-sanjeev" }),
    m("m41", "p4", 2, "Catchment analysis", { base: 5, state: "in_progress", ownerId: "u-tashi", criteria: "All 40 sites analysed." }),
    m("m42", "p4", 7, "Board recommendation", { base: 45, ownerId: "u-tashi", criteria: "Board accepts ranked shortlist." }),
  )

  db.blockers.push(
    {
      id: "b1",
      projectId: "p1",
      reason: "IT asset inventory export not yet provided by Gera IT",
      type: "client input",
      responsibleId: "u-arjun",
      raisedAt: dt(-12),
      expectedResolution: d(3),
      milestoneIds: ["m5"],
      audience: ws("ws-it"),
      authorId: "u-sanjeev",
    },
    {
      id: "b2",
      projectId: "p3",
      reason: "Chakan plant site access suspended (maintenance shutdown)",
      type: "client decision",
      responsibleId: "u-gulzer",
      raisedAt: dt(-22),
      expectedResolution: d(-2),
      milestoneIds: ["m32"],
      audience: CLIENT,
      authorId: "u-tashi",
    },
  )

  db.actions.push(
    { id: "a1", projectId: "p1", description: "Share the current HR policy handbook (2025 edition)", ownerId: "u-diva", due: d(2), source: { kind: "publication", id: "pub2", label: "HR design workshop" }, state: "open", audience: ws("ws-hr"), authorId: "u-sanjeev", createdAt: dt(-10) },
    { id: "a2", projectId: "p1", description: "Confirm the December steering committee date", ownerId: "u-gulzer", due: d(4), source: { kind: "publication", id: "pub1", label: "Steering Committee #2" }, state: "open", audience: CLIENT, authorId: "u-tashi", createdAt: dt(-8) },
    { id: "a3", projectId: "p1", description: "Draft role-mapping template for HR", ownerId: "u-shrenik-team", due: d(1), source: { kind: "manual", label: "Team planning" }, state: "open", audience: TEAM, authorId: "u-sanjeev", createdAt: dt(-9) },
    { id: "a4", projectId: "p1", description: "Provide IT asset inventory export (CMDB extract)", ownerId: "u-arjun", due: d(-3), source: { kind: "manual", label: "Blocker B-1" }, state: "open", audience: ws("ws-it"), authorId: "u-sanjeev", createdAt: dt(-12) },
    { id: "a6", projectId: "p5", description: "Hand over onboarding checklist template to Gera procurement", ownerId: "u-sanjeev", due: d(1), source: { kind: "manual", label: "Closure prep" }, state: "open", audience: CLIENT, authorId: "u-tashi", createdAt: dt(-3) },
    { id: "a5", projectId: "p1", description: "Circulate interview schedule for IT leads", ownerId: "u-sanjeev", source: { kind: "manual", label: "Team planning" }, state: "done", audience: TEAM, authorId: "u-sanjeev", createdAt: dt(-30) },
  )

  // ── Documents ─────────────────────────────────────────────────────────────
  const v = (n: number, fileName: string, sizeKb: number, changeNote: string, off: number, by = "u-sanjeev") => ({
    n, fileName, sizeKb, changeNote, uploadedAt: dt(off, 14), uploadedBy: by,
  })
  db.documents.push(
    { id: "doc1", projectId: "p1", title: "Current-State Assessment Report", kind: "deliverable", phaseId: "p1-ph2", audience: CLIENT, authorId: "u-sanjeev", publishedAt: dt(-46), versions: [v(1, "Gera_CurrentState_v1.pdf", 4200, "Initial release for review.", -48), v(2, "Gera_CurrentState_v2.pdf", 4380, "Added Ranjangaon plant interviews and corrected headcount table (p.14).", -45)] },
    { id: "doc2", projectId: "p1", title: "HR Target Operating Model", kind: "deliverable", phaseId: "p1-ph4", audience: ws("ws-hr"), authorId: "u-sanjeev", publishedAt: dt(-2), versions: [v(1, "HR_TOM_v1.pdf", 2900, "Draft for review: service catalogue, org design, RACI.", -2)] },
    { id: "doc3", projectId: "p1", title: "IT landscape working notes", kind: "working", phaseId: "p1-ph4", audience: TEAM, authorId: "u-sanjeev", versions: [v(1, "IT_landscape_notes.docx", 310, "Working notes.", -7)] },
    { id: "doc4", projectId: "p1", title: "Executive compensation benchmarks", kind: "reference", phaseId: "p1-ph4", audience: { kind: "named", userIds: ["u-tashi", "u-gulzer"] }, authorId: "u-tashi", publishedAt: dt(-15), versions: [v(1, "Exec_Comp_Benchmarks.xlsx", 880, "Benchmarks for CXO-1 and CXO-2 bands.", -15, "u-tashi")] },
    { id: "doc5", projectId: "p1", title: "Raw interview notes — HR leads", kind: "working", phaseId: "p1-ph2", audience: TEAM, authorId: "u-shrenik-team", versions: [v(1, "HR_interviews_raw.docx", 540, "Raw notes.", -50, "u-shrenik-team")] },
    { id: "doc6", projectId: "p1", title: "Role-mapping workbook (draft)", kind: "deliverable", phaseId: "p1-ph4", audience: { kind: "draft" }, authorId: "u-sanjeev", versions: [v(1, "Role_Mapping_draft.xlsx", 1200, "First pass.", -1)] },
    { id: "doc7", projectId: "p1", title: "Steering Committee #2 — slides", kind: "reference", phaseId: "p1-ph4", audience: CLIENT, authorId: "u-tashi", publishedAt: dt(-8), versions: [v(1, "SteerCo2_slides.pdf", 2100, "As presented.", -9, "u-tashi")] },
    { id: "doc8", projectId: "p1", title: "ITSM vendor shortlist", kind: "reference", phaseId: "p1-ph4", audience: ws("ws-it"), authorId: "u-sanjeev", publishedAt: dt(-6), versions: [v(1, "ITSM_shortlist.pdf", 760, "Shortlist of 3 vendors.", -6)] },
    { id: "doc9", projectId: "p1", title: "Old org chart (retracted)", kind: "reference", phaseId: "p1-ph2", audience: CLIENT, authorId: "u-sanjeev", publishedAt: dt(-40), retracted: { reason: "Contained personal data of employees on leave; replaced by anonymised chart in the assessment report.", at: dt(-39), by: "u-tashi" }, versions: [v(1, "OrgChart.pdf", 300, "Initial.", -40)] },
    { id: "doc21", projectId: "p2", title: "Procurement proposal deck", kind: "reference", audience: CLIENT, authorId: "u-tashi", publishedAt: dt(-6), versions: [v(1, "Procurement_Proposal.pdf", 1900, "Proposal deck v1.", -6, "u-tashi")] },
    { id: "doc51", projectId: "p5", title: "Supplier Code of Conduct v2", kind: "deliverable", audience: CLIENT, authorId: "u-tashi", publishedAt: dt(-6), versions: [v(1, "Supplier_Code_v2.pdf", 1300, "Revised code for approval.", -6, "u-tashi")] },
    { id: "doc41", projectId: "p4", title: "Helix catchment interim findings", kind: "deliverable", audience: CLIENT, authorId: "u-tashi", publishedAt: dt(-3), versions: [v(1, "Helix_catchment_interim.pdf", 2200, "Interim.", -3, "u-tashi")] },
  )

  // ── Decisions ─────────────────────────────────────────────────────────────
  db.decisions.push(
    { id: "dec1", projectId: "p1", statement: "Adopt a hub-and-spoke model for HR service delivery", context: "Steering Committee #2", partyIds: ["u-gulzer", "u-tashi"], date: d(-9), sourcePublicationId: "pub1", state: "active", audience: CLIENT, authorId: "u-tashi" },
    { id: "dec2", projectId: "p1", statement: "Payroll stays in-house for phase 1", context: "HR design workshop", partyIds: ["u-diva", "u-gulzer", "u-sanjeev"], date: d(-11), sourcePublicationId: "pub2", state: "under_revisit", audience: ws("ws-hr"), authorId: "u-sanjeev" },
    { id: "dec3", projectId: "p1", statement: "Use ServiceNow as the ITSM reference baseline", context: "IT landscape review", partyIds: ["u-arjun", "u-sanjeev"], date: d(-6), state: "active", audience: ws("ws-it"), authorId: "u-sanjeev" },
    { id: "dec4", projectId: "p1", statement: "Scope and plan approved for execution", context: "Estimate v1 approval", partyIds: ["u-gulzer"], date: d(-38), state: "active", audience: CLIENT, authorId: "u-tashi" },
  )

  // ── Publications ──────────────────────────────────────────────────────────
  db.publications.push(
    {
      id: "pub1", projectId: "p1", kind: "meeting", title: "Steering Committee #2", meetingAt: dt(-9, 15), publishedAt: dt(-8, 10), createdAt: dt(-8, 9),
      summary: "Reviewed current-state findings and the two HR delivery options. Committee chose the hub-and-spoke model. IT blueprint timing discussed given the pending asset inventory.",
      attendeeIds: ["u-tashi", "u-sanjeev", "u-gulzer", "u-rohit"], decisionIds: ["dec1"], actionIds: ["a2"],
      attachments: [{ documentId: "doc7", version: 1 }, { documentId: "doc1", version: 2 }],
      teamRemarks: "Rohit pushed hard on timeline — expect scrutiny on the IT slip. Gulzer wants the TOM walkthrough before it goes wider.",
      actionRequired: false, state: "published", version: 1, audience: CLIENT, authorId: "u-tashi",
    },
    {
      id: "pub2", projectId: "p1", kind: "meeting", title: "HR design workshop", meetingAt: dt(-11, 11), publishedAt: dt(-5, 19), createdAt: dt(-5, 18),
      summary: "Walked through HR service catalogue options with the HR operations team. Agreed payroll remains in-house for phase 1. Policy handbook needed to complete the catalogue.",
      attendeeIds: ["u-sanjeev", "u-shrenik-team", "u-diva", "u-gulzer"], decisionIds: ["dec2"], actionIds: ["a1"],
      attachments: [], teamRemarks: "Diva's team is stretched; keep asks small and specific.",
      actionRequired: true, state: "published", version: 1, audience: ws("ws-hr"), authorId: "u-sanjeev",
    },
    {
      id: "pub3", projectId: "p1", kind: "deliverable", title: "HR Target Operating Model — for review", publishedAt: dt(-2, 12), createdAt: dt(-2, 11),
      summary: "Draft HR TOM covering service catalogue, organisation design and RACI. Approval requested from Gulzer.",
      attendeeIds: [], decisionIds: [], actionIds: [], attachments: [{ documentId: "doc2", version: 1 }],
      actionRequired: true, state: "published", version: 1, audience: ws("ws-hr"), authorId: "u-sanjeev",
    },
    {
      id: "pub4", projectId: "p1", kind: "update", title: "Weekly update — week 10", publishedAt: dt(-4, 18), createdAt: dt(-4, 17),
      summary: "HR TOM nearly ready. IT blueprint moved by ten days pending the asset inventory export (see Journey for reason).",
      attendeeIds: [], decisionIds: [], actionIds: [], attachments: [], actionRequired: false, state: "published", version: 1, audience: CLIENT, authorId: "u-tashi",
    },
    {
      id: "pub5", projectId: "p1", kind: "meeting", title: "IT landscape review", meetingAt: dt(-6, 16), publishedAt: dt(-6, 20), createdAt: dt(-6, 19),
      summary: "Reviewed the current application map with Arjun. ServiceNow agreed as the ITSM reference baseline.",
      attendeeIds: ["u-sanjeev", "u-arjun"], decisionIds: ["dec3"], actionIds: ["a4"], attachments: [{ documentId: "doc8", version: 1 }],
      teamRemarks: "Inventory export is the critical path — escalate via Gulzer if not in by Friday.",
      actionRequired: false, state: "published", version: 1, audience: ws("ws-it"), authorId: "u-sanjeev",
    },
    {
      id: "pub41", projectId: "p4", kind: "update", title: "Helix interim catchment findings", publishedAt: dt(-3), createdAt: dt(-3),
      summary: "28 of 40 sites analysed.", attendeeIds: [], decisionIds: [], actionIds: [], attachments: [{ documentId: "doc41", version: 1 }],
      actionRequired: false, state: "published", version: 1, audience: CLIENT, authorId: "u-tashi",
    },
  )

  db.threads.push(
    { id: "th1", projectId: "p1", subject: { kind: "publication", id: "pub1" }, audience: "shared", purpose: "discussion", resolved: false, comments: [
      { id: "c1", authorId: "u-gulzer", body: "Thanks — can we get the slides in the deck format our board uses?", at: dt(-7, 10) },
      { id: "c2", authorId: "u-tashi", body: "Yes, we'll reformat for the December board pack.", at: dt(-7, 12) },
    ] },
    { id: "th2", projectId: "p1", subject: { kind: "publication", id: "pub1" }, audience: "team", purpose: "discussion", resolved: false, comments: [
      { id: "c3", authorId: "u-sanjeev", body: "Internal: board template is in the Gera brand kit folder.", at: dt(-7, 13) },
    ] },
  )

  // ── Estimates ─────────────────────────────────────────────────────────────
  const snap = (ids: string[]) => db.milestones.filter((x) => ids.includes(x.id)).map((x) => ({ milestoneId: x.id, name: x.name, date: x.baselineDate ?? x.currentDate }))
  db.estimates.push(
    {
      id: "est1", projectId: "p1", version: 1, state: "approved",
      scope: "Current-state assessment, HR target operating model, IT systems blueprint, consolidated recommendations.",
      deliverables: ["Current-state assessment report", "HR target operating model", "IT systems landscape blueprint", "Consolidated recommendations & roadmap"],
      effortDays: 260, durationWeeks: 19,
      lineItems: [
        { id: "li1", label: "CEO", qty: 30, unit: "days", rate: 180000 },
        { id: "li2", label: "Senior consultant", qty: 110, unit: "days", rate: 95000 },
        { id: "li3", label: "Analyst", qty: 120, unit: "days", rate: 55000 },
      ],
      expenses: 650000, taxRate: 18,
      assumptions: ["Gera provides timely access to HR and IT data owners", "Work is based in Pune with up to 6 plant visits"],
      exclusions: ["System implementation", "Change management roll-out"],
      validUntil: d(-60), detailLevel: "line_items",
      internal: { costPerDay: 42000, targetMarginPct: 38, notes: "Analyst rate discounted 10% for multi-project relationship." },
      createdAt: dt(-85), createdBy: "u-tashi", sharedAt: dt(-80), approvedAt: dt(-72),
      scheduleSnapshot: snap(["m2", "m3", "m4", "m5", "m6", "m7", "m8"]),
    },
    {
      id: "est1b", projectId: "p1", version: 2, state: "draft",
      scope: "As v1, plus Finance shared-services assessment (CR-2).",
      deliverables: ["Current-state assessment report", "HR target operating model", "IT systems landscape blueprint", "Finance shared-services assessment", "Consolidated recommendations & roadmap"],
      effortDays: 290, durationWeeks: 21,
      lineItems: [
        { id: "li1", label: "CEO", qty: 33, unit: "days", rate: 180000 },
        { id: "li2", label: "Senior consultant", qty: 125, unit: "days", rate: 95000 },
        { id: "li3", label: "Analyst", qty: 132, unit: "days", rate: 55000 },
      ],
      expenses: 720000, taxRate: 18,
      assumptions: ["Gera provides timely access to HR, IT and Finance data owners"],
      exclusions: ["System implementation", "Change management roll-out"],
      validUntil: d(30), detailLevel: "line_items",
      internal: { costPerDay: 42000, targetMarginPct: 37, notes: "Finance module priced at standard rates." },
      createdAt: dt(-1), createdBy: "u-tashi",
      scheduleSnapshot: snap(["m4", "m5", "m6", "m7", "m8"]),
    },
    {
      id: "est2", projectId: "p2", version: 1, state: "shared",
      scope: "Indirect procurement savings diagnostic and playbooks across logistics, MRO and IT.",
      deliverables: ["Spend cube & baseline", "Three category deep-dives", "Negotiation playbooks", "Savings plan"],
      effortDays: 180, durationWeeks: 14,
      lineItems: [
        { id: "li1", label: "CEO", qty: 18, unit: "days", rate: 180000 },
        { id: "li2", label: "Senior consultant", qty: 72, unit: "days", rate: 95000 },
        { id: "li3", label: "Analyst", qty: 90, unit: "days", rate: 55000 },
      ],
      expenses: 400000, taxRate: 18,
      assumptions: ["12 months of AP data available in SAP"],
      exclusions: ["Direct materials", "Supplier negotiations led by Morphoverse"],
      validUntil: d(20), detailLevel: "total",
      internal: { costPerDay: 42000, targetMarginPct: 40, notes: "Opportunity to bundle with P1 extension." },
      createdAt: dt(-9), createdBy: "u-tashi", sharedAt: dt(-6),
      scheduleSnapshot: snap(["m21", "m22", "m23"]),
    },
    {
      id: "est3", projectId: "p3", version: 1, state: "approved",
      scope: "Audit process digitisation and two-plant pilot.", deliverables: ["Audit process map", "Tool selection", "Pilot report"],
      effortDays: 95, durationWeeks: 14,
      lineItems: [{ id: "li1", label: "Blended team", qty: 95, unit: "days", rate: 82000 }],
      expenses: 180000, taxRate: 18, assumptions: ["Site access to both plants"], exclusions: ["Hardware"],
      validUntil: d(-50), detailLevel: "line_items",
      internal: { costPerDay: 40000, targetMarginPct: 36, notes: "" },
      createdAt: dt(-70), createdBy: "u-tashi", sharedAt: dt(-68), approvedAt: dt(-62),
      scheduleSnapshot: snap(["m31", "m32"]),
    },
    {
      id: "est5", projectId: "p5", version: 1, state: "approved",
      scope: "Supplier code refresh.", deliverables: ["Benchmark", "Revised code", "Onboarding checklist"],
      effortDays: 40, durationWeeks: 8,
      lineItems: [{ id: "li1", label: "Blended team", qty: 40, unit: "days", rate: 85000 }],
      expenses: 60000, taxRate: 18, assumptions: [], exclusions: ["Supplier audits"],
      validUntil: d(-40), detailLevel: "line_items",
      internal: { costPerDay: 40000, targetMarginPct: 40, notes: "" },
      createdAt: dt(-60), createdBy: "u-tashi", sharedAt: dt(-58), approvedAt: dt(-55),
      scheduleSnapshot: snap(["m51", "m52", "m53"]),
    },
    {
      id: "est4", projectId: "p4", version: 1, state: "approved",
      scope: "Store network expansion review.", deliverables: ["Catchment analysis", "Site scoring model", "Board recommendation"],
      effortDays: 70, durationWeeks: 11,
      lineItems: [{ id: "li1", label: "Blended team", qty: 70, unit: "days", rate: 90000 }],
      expenses: 120000, taxRate: 18, assumptions: [], exclusions: [],
      validUntil: d(-25), detailLevel: "total",
      internal: { costPerDay: 40000, targetMarginPct: 42, notes: "" },
      createdAt: dt(-40), createdBy: "u-tashi", sharedAt: dt(-38), approvedAt: dt(-33),
      scheduleSnapshot: snap(["m41", "m42"]),
    },
  )

  // ── Approvals ─────────────────────────────────────────────────────────────
  db.approvals.push(
    { id: "ap0", projectId: "p1", title: "Engagement estimate v1", subject: { kind: "estimate", id: "est1", version: 1 }, tier: "A", approverIds: ["u-gulzer"], rule: "any", due: d(-74), state: "approved", requestedBy: "u-tashi", createdAt: dt(-80),
      responses: [{ userId: "u-gulzer", outcome: "approve", comment: "Approved as discussed with the CFO.", at: dt(-72, 16), method: "Fresh sign-in + OTP" }] },
    { id: "ap1", projectId: "p1", title: "HR target operating model (milestone)", subject: { kind: "milestone", id: "m4" }, tier: "B", approverIds: ["u-gulzer"], rule: "any", due: d(3), state: "pending", requestedBy: "u-sanjeev", createdAt: dt(-2, 12), responses: [] },
    { id: "ap2", projectId: "p2", title: "Procurement proposal — estimate v1", subject: { kind: "estimate", id: "est2", version: 1 }, tier: "A", approverIds: ["u-gulzer"], rule: "any", due: d(-2), state: "pending", requestedBy: "u-tashi", createdAt: dt(-6), responses: [] },
    { id: "ap3", projectId: "p1", title: "Current-state assessment (milestone)", subject: { kind: "milestone", id: "m2" }, tier: "B", approverIds: ["u-gulzer"], rule: "any", due: d(-44), state: "approved", requestedBy: "u-sanjeev", createdAt: dt(-46),
      responses: [{ userId: "u-gulzer", outcome: "approve", comment: "", at: dt(-44, 11), method: "Secure one-click link" }] },
  )

  // ── Change requests ───────────────────────────────────────────────────────
  db.changeRequests.push(
    { id: "cr1", number: 1, projectId: "p1", category: "revisit decision", what: "Bring payroll into the phase 1 shared-services scope", why: "Payroll errors at Ranjangaon are now a board-level concern; keeping it out of phase 1 delays the fix by a year.", timing: "Before the role-mapping workbook is finalised", submittedAt: dt(-3, 10), state: "under_review", linkedDecisionId: "dec2", audience: ws("ws-hr"), authorId: "u-diva" },
    { id: "cr2", number: 2, projectId: "p1", category: "change scope", what: "Add a Finance shared-services assessment", why: "CFO wants Finance assessed alongside HR so the hub design covers both.", timing: "This quarter", submittedAt: dt(-10, 15), state: "awaiting_client_approval", audience: CLIENT, authorId: "u-gulzer",
      impact: { milestoneIds: ["m7", "m8"], dateShiftDays: 14, scope: "Adds Finance shared-services assessment to the recommendations pack.", effortDays: 30, costDelta: 2_436_600, needsClientApproval: true, at: dt(-2), by: "u-tashi" }, approvalId: "ap4" },
  )
  db.approvals.push({ id: "ap4", projectId: "p1", title: "CR-2 Finance assessment — commercial change", subject: { kind: "change_request", id: "cr2" }, tier: "A", approverIds: ["u-gulzer"], rule: "any", due: d(5), state: "pending", requestedBy: "u-tashi", createdAt: dt(-2), responses: [] })

  db.accessRequests.push({ id: "ar1", projectId: "p1", documentId: "doc4", userId: "u-rohit", reason: "Need to brief the board remuneration committee.", state: "pending", at: dt(-1, 9) })

  // ── Audit (seeded history) ────────────────────────────────────────────────
  const log = (projectId: string | undefined, off: number, actorId: string, action: string, detail: string, security = false) =>
    db.audit.push({ id: `au-${db.audit.length + 1}`, projectId, at: dt(off, 12), actorId, action, detail, security })
  log("p1", -85, "u-tashi", "Project created", "GERA-2026-001 created from default 8-phase template")
  log("p1", -80, "u-tashi", "Estimate shared", "Estimate v1 shared with Gulzer (Tier A approval requested)")
  log("p1", -72, "u-gulzer", "Approval decided", "Estimate v1 approved (Fresh sign-in + OTP)")
  log("p1", -72, "system", "Lifecycle changed", "Proposal → Active. Baseline dates frozen for 9 milestones")
  log("p1", -46, "u-sanjeev", "Published", "Current-State Assessment Report v1 → Client-wide")
  log("p1", -39, "u-tashi", "Retracted", "Old org chart retracted: personal data")
  log("p1", -8, "u-tashi", "Published", "Meeting record 'Steering Committee #2' → Client-wide")
  log("p1", -4, "u-tashi", "Date changed", "IT systems landscape blueprint: current date moved +10 days (linked to blocker B-1)")
  log("p1", -2, "u-sanjeev", "Approval requested", "HR target operating model → Gulzer (Tier B)")
  log("p1", -1, "u-rohit", "Access requested", "Executive compensation benchmarks (Named) — reason recorded")
  log(undefined, -14, "u-admin", "User invited", "arjun.nair@geradevelopment.com invited with preset 'Workstream contributor'", true)
  log(undefined, -3, "unknown", "Failed sign-in", "3 failed OTP attempts for priya.patel@geradevelopment.com", true)
  log("p5", -55, "u-gulzer", "Approval decided", "Estimate v1 approved (Fresh sign-in + OTP)")
  log("p5", -5, "u-gulzer", "Approval decided", "Revised code of conduct accepted (one-click link)")
  log("p3", -20, "u-tashi", "Lifecycle changed", "Active → Paused: Site access for Chakan plant suspended")

  return db
}
