// Commercial step at project creation, and estimate supporting files with their access rules.
import { describe, expect, it } from "vitest"
import { db } from "@/lib/store"
import { GET as download } from "@/app/api/files/[docId]/route"
import { documents, estimateFiles } from "@/lib/data"
import { search } from "@/lib/search"
import { addEstimateFile, advanceEstimate, createProject, removeEstimateFile, updateEstimate, type EstimateFields, type NewProjectInput } from "@/lib/actions"
import { as, ok, raw, refused, shell, user } from "./support/session"

const fetchFile = async (userId: string, docId: string) => {
  as(userId)
  const res = await download(new Request(`http://test/api/files/${docId}`), { params: Promise.resolve({ docId }) })
  return res.status
}

const fields = (over: Partial<EstimateFields> = {}): EstimateFields => ({
  lineItems: [{ id: "l1", label: "Senior consultant", qty: 40, unit: "days", rate: 95000 }],
  effortDays: 40,
  durationWeeks: 10,
  expenses: 50000,
  taxRate: 18,
  deliverables: ["Finance target model", ""],
  assumptions: ["Data owners available"],
  exclusions: [],
  detailLevel: "line_items",
  validUntil: "2027-02-01",
  costPerDay: 40000,
  targetMarginPct: 40,
  internalNotes: "Discounted day rate.",
  ...over,
})

const project = (over: Partial<NewProjectInput> = {}): NewProjectInput => ({
  name: "Finance Shared Services Assessment",
  clientOrgId: "org-nova",
  ownerId: "u-tashi",
  objectives: "Assess Finance shared services across the plants.",
  scope: "Current state, target model, business case.",
  plannedStart: "2027-01-04",
  targetEnd: "2027-04-30",
  workstreams: ["Finance"],
  teamIds: [],
  clientLeadId: "u-gulzer",
  ...over,
})

describe("Commercial step when creating a project", () => {
  it("creates a private draft v1 with its supporting files", async () => {
    const r = ok(await createProject(project({ estimate: { ...fields(), files: ["RateCard.xlsx", "Pricing_Rationale.pdf"] } })))
    const e = db().estimates.find((x) => x.projectId === r.id)!
    expect(e).toMatchObject({ version: 1, state: "draft", effortDays: 40 })
    expect(e.deliverables).toEqual(["Finance target model"]) // blanks dropped
    expect(e.attachmentIds).toHaveLength(2)
    expect(db().documents.filter((d) => e.attachmentIds.includes(d.id)).every((d) => d.kind === "commercial" && d.audience.kind === "team")).toBe(true)
    expect(shell("u-gulzer", r.id!)).toBeNull() // Setup: client sees nothing yet
  })

  it("rejects a bad file before anything is created", async () => {
    const before = db().projects.length
    refused(await createProject(project({ estimate: { ...fields(), files: ["eicar_test.pdf"] } })), /Malware/)
    expect(db().projects.length).toBe(before)
  })

  it("skips the estimate when no line item is filled in", async () => {
    const r = ok(await createProject(project({ estimate: { ...fields({ lineItems: [{ id: "l", label: " ", qty: 1, unit: "days", rate: 0 }] }), files: [] } })))
    expect(db().estimates.some((x) => x.projectId === r.id)).toBe(false)
  })
})

describe("Estimate supporting files: who can see them", () => {
  it("the client lead and Executive Director see files of a shared estimate; stakeholders never do", async () => {
    expect(estimateFiles(raw("u-gulzer", "p1"), "est1").map((f) => f.id)).toEqual(["doc11"])
    expect(await fetchFile("u-gulzer", "doc11")).toBe(200)
    expect(await fetchFile("u-rohit", "doc11")).toBe(200)
    expect(estimateFiles(raw("u-diva", "p1"), "est1")).toHaveLength(0)
    expect(await fetchFile("u-diva", "doc11")).toBe(404)
    expect(await fetchFile("u-emma", "doc11")).toBe(404)
  })

  it("files stay out of general document lists and client search", () => {
    expect(documents(raw("u-gulzer", "p1")).map((d) => d.id)).not.toContain("doc11")
    expect(search(user("u-gulzer"), "rate card")).toHaveLength(0)
  })

  it("files on a draft stay private until that version is shared, then lock", async () => {
    as("u-tashi")
    ok(await updateEstimate("p1", "est1b", { ...fields(), scope: "As v1 plus Finance." }))
    ok(await addEstimateFile("p1", "est1b", "Finance_RateCard.pdf"))
    const docId = db().estimates.find((x) => x.id === "est1b")!.attachmentIds.at(-1)!
    expect(await fetchFile("u-gulzer", docId)).toBe(404)

    as("u-tashi")
    ok(await advanceEstimate("p1", "est1b", "review"))
    refused(await addEstimateFile("p1", "est1b", "Late.pdf"), /locked/)
    refused(await removeEstimateFile("p1", "est1b", docId), /locked/)
    ok(await advanceEstimate("p1", "est1b", "share"))
    expect(await fetchFile("u-gulzer", docId)).toBe(200)
  })

  it("only the CEO manages files, and bad files are rejected", async () => {
    as("u-sanjeev")
    refused(await addEstimateFile("p1", "est1b", "x.pdf"), /CEO/)
    as("u-tashi")
    refused(await addEstimateFile("p1", "est1b", "virus.exe"), /not allowed/)
  })

  it("an estimate needs at least one deliverable before review", async () => {
    as("u-tashi")
    ok(await updateEstimate("p1", "est1b", { ...fields({ deliverables: ["  "] }), scope: "No deliverables." }))
    refused(await advanceEstimate("p1", "est1b", "review"), /deliverable/)
  })
})
