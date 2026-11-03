// REQ-SRC-01 audience-safe search, and REQ-PRJ-01 project creation through Setup → Proposal → Active.
import { describe, expect, it } from "vitest"
import { db } from "@/lib/store"
import { search } from "@/lib/search"
import { approvals, milestones } from "@/lib/data"
import { addMember, addMilestone, addWorkstream, advanceEstimate, createProject, decideApproval, newEstimateVersion, updateEstimate, type NewProjectInput } from "@/lib/actions"
import { as, ok, refused, shell, user } from "./support/session"

const hits = (userId: string, q: string) => search(user(userId), q)
const kinds = (userId: string, q: string) => hits(userId, q).map((h) => h.kind)

describe("REQ-SRC-01 audience-safe search", () => {
  it("never returns other workstreams' items (T-04)", () => {
    expect(hits("u-priya", "ServiceNow")).toHaveLength(0)
    expect(kinds("u-arjun", "ServiceNow")).toEqual(expect.arrayContaining(["Decision", "Publication"]))
  })

  it("never returns Team remarks or Team threads to clients (T-10)", () => {
    expect(hits("u-jordan", "scrutiny")).toHaveLength(0)
    expect(kinds("u-sarah", "scrutiny")).toContain("Team remarks")
    expect(hits("u-jordan", "brand kit")).toHaveLength(0)
    expect(hits("u-alex", "brand kit")).toHaveLength(0)
    expect(kinds("u-sarah", "brand kit")).toContain("Comment")
  })

  it("never reveals Named items, not even their titles (T-05)", () => {
    expect(hits("u-alex", "compensation")).toHaveLength(0)
    expect(hits("u-rajiv", "compensation")).toHaveLength(0)
    expect(kinds("u-jordan", "compensation")).toContain("Document")
  })

  it("stays inside the user's organisation and projects (T-01, T-02)", () => {
    expect(hits("u-emma", "Nova")).toHaveLength(0)
    expect(hits("u-priya", "Procurement")).toHaveLength(0)
    expect(hits("u-admin", "Nova")).toHaveLength(0)
  })

  it("skips retracted records and needs at least two characters", () => {
    expect(hits("u-jordan", "org chart")).toHaveLength(0)
    expect(hits("u-sarah", "a")).toHaveLength(0)
  })
})

const input = (over: Partial<NewProjectInput> = {}): NewProjectInput => ({
  name: "Finance Shared Services Assessment",
  clientOrgId: "org-nova",
  ownerId: "u-sarah",
  objectives: "Assess Finance shared services across Nova's plants.",
  scope: "Current state, target model, business case.",
  plannedStart: "2027-01-04",
  targetEnd: "2027-04-30",
  workstreams: ["Finance"],
  teamIds: ["u-david"],
  clientLeadId: "u-jordan",
  ...over,
})
const created = () => db().projects.at(-1)!

describe("REQ-PRJ-01 creating a project", () => {
  it("Directors create and own projects in Setup with 8 phases and a generated ID", async () => {
    as("u-david")
    refused(await createProject(input()), /Director or Administrator/)
    as("u-sarah")
    const r = ok(await createProject(input({ ownerId: "u-rajiv" })))
    const p = created()
    expect(r.id).toBe(p.id)
    expect(p.code).toBe("NOVA-2027-001")
    expect(p.lifecycle).toBe("setup")
    expect(p.ownerId).toBe("u-sarah") // a Director creating a project owns it
    expect(db().phases.filter((x) => x.projectId === p.id)).toHaveLength(8)
    expect(shell("u-david", p.id)).not.toBeNull()
    expect(shell("u-jordan", p.id)).toBeNull() // clients see nothing in Setup (T-03)
    expect(shell("u-alex", p.id)).toBeNull()
  })

  it("Administrators create the shell for a Director without gaining access", async () => {
    as("u-admin")
    refused(await createProject(input({ ownerId: "u-david" })), /Director/)
    ok(await createProject(input({ ownerId: "u-rajiv" })))
    const p = created()
    expect(p.ownerId).toBe("u-rajiv")
    expect(shell("u-admin", p.id)).toBeNull()
  })

  it("validates workstreams, dates and the client organisation", async () => {
    refused(await createProject(input({ workstreams: ["  "] })), /workstream/)
    refused(await createProject(input({ targetEnd: "2026-12-01" })), /after/)
    refused(await createProject(input({ clientLeadId: "u-emma" })), /client organisation/)
  })
})

describe("Setup → Proposal → Active for a new project", () => {
  it("runs the whole path with baselines frozen on approval", async () => {
    ok(await createProject(input({ clientLeadId: undefined })))
    const p = created()
    const ws = db().workstreams.find((w) => w.projectId === p.id)!

    as("u-david")
    refused(await addWorkstream(p.id, "Treasury"), /manage-access/)
    as("u-sarah")
    ok(await addWorkstream(p.id, "Treasury"))

    refused(await addMember(p.id, "u-emma", "client_lead", []), /client organisation/)
    refused(await addMember(p.id, "u-alex", "client_lead", []), /client organisation/)
    ok(await addMember(p.id, "u-jordan", "client_lead", [ws.id]))

    const phase = db().phases.find((x) => x.projectId === p.id && x.order === 4)!
    refused(await addMilestone(p.id, { name: "Finance target model", phaseId: phase.id, ownerId: "u-sarah", acceptance: "client", criteria: "", date: "2027-03-01" }), /criteria/)
    ok(await addMilestone(p.id, { name: "Finance target model", phaseId: phase.id, workstreamId: ws.id, ownerId: "u-sarah", counterpartId: "u-jordan", acceptance: "client", criteria: "Org design and service catalogue.", date: "2027-03-01" }))
    const m = db().milestones.find((x) => x.projectId === p.id)!
    expect(m.baselineDate).toBeUndefined()

    ok(await newEstimateVersion(p.id))
    const est = db().estimates.find((e) => e.projectId === p.id)!
    ok(await updateEstimate(p.id, est.id, { scope: "Finance assessment.", effortDays: 60, durationWeeks: 16, expenses: 100000, taxRate: 18, lineItems: [{ id: "l1", label: "Blended team", qty: 60, unit: "days", rate: 90000 }], detailLevel: "line_items", internalNotes: "", costPerDay: 40000, targetMarginPct: 40, validUntil: "2027-02-01" }))
    ok(await advanceEstimate(p.id, est.id, "review"))
    ok(await advanceEstimate(p.id, est.id, "share"))
    expect(created().lifecycle).toBe("proposal")

    const jordan = shell("u-jordan", p.id)!
    expect(milestones(jordan)).toHaveLength(0) // Proposal: only the estimate
    const ap = approvals(jordan).find((a) => a.subject.kind === "estimate")!
    as("u-jordan")
    ok(await decideApproval(p.id, ap.id, "approve", "", "123456"))
    expect(created().lifecycle).toBe("active")
    expect(db().milestones.find((x) => x.id === m.id)!.baselineDate).toBe("2027-03-01")

    as("u-sarah")
    refused(await addMilestone(p.id, { name: "Treasury review", phaseId: phase.id, ownerId: "u-sarah", acceptance: "internal", criteria: "", date: "2027-03-15" }), /change request/)
  })
})
