// Permission suite (NFR-16): every audience × role, through the same
// data-layer queries, server actions and file route the UI uses.
import { describe, expect, it } from "vitest"
import { db } from "@/lib/store"
import { GET as download } from "@/app/api/files/[docId]/route"
import { approvals, audit, documents, getViewer, milestones, projectsFor, publications, threads } from "@/lib/data"
import { isProjectStaff } from "@/lib/access/audience"
import { addComment, adminSelfGrant, changeMilestoneDate, decideAccess, decideApproval, inviteUser, postStatus, requestAccess, setUserStatus } from "@/lib/actions"
import { as, notesTo, ok, raw, refused, shell, user } from "./support/session"

const ids = (xs: { id: string }[]) => xs.map((x) => x.id)
const fetchFile = async (userId: string, docId: string) => {
  as(userId)
  const res = await download(new Request(`http://test/api/files/${docId}`), { params: Promise.resolve({ docId }) })
  return res.status
}
const fullDocs = (userId: string, projectId: string) => documents(raw(userId, projectId)).filter((d) => !("restricted" in d))
const stubs = (userId: string, projectId: string) => documents(raw(userId, projectId)).filter((d) => "restricted" in d)

describe("T-01 project isolation", () => {
  it("a user on Project 1 only cannot find or open Project 2", async () => {
    expect(ids(projectsFor(user("u-diva")))).not.toContain("p2")
    expect(shell("u-diva", "p2")).toBeNull()
    expect(documents(raw("u-diva", "p2"))).toHaveLength(0)
    expect(await fetchFile("u-diva", "doc21")).toBe(404)
  })
})

describe("T-02 organisation isolation", () => {
  it("a Helix user never sees, opens or is notified about Nova projects", async () => {
    expect(ids(projectsFor(user("u-emma")))).toEqual(["p4"])
    for (const p of ["p1", "p2", "p3", "p5"]) expect(shell("u-emma", p)).toBeNull()
    expect(await fetchFile("u-emma", "doc1")).toBe(404)
    as("u-tashi")
    ok(await postStatus("p1", { text: "Weekly status for everyone on P1.", health: "on_track", explanation: "", nextSteps: "" }))
    expect(notesTo("u-emma")).toHaveLength(0)
  })
})

describe("T-03 lifecycle gating for client users", () => {
  it("sees nothing in Setup, and only the shared estimate in Proposal", () => {
    db().projects.find((p) => p.id === "p2")!.lifecycle = "setup"
    expect(shell("u-gulzer", "p2")).toBeNull()

    db().projects.find((p) => p.id === "p2")!.lifecycle = "proposal"
    const ctx = shell("u-gulzer", "p2")!
    expect(ctx).not.toBeNull()
    expect(documents(ctx)).toHaveLength(0)
    expect(publications(ctx)).toHaveLength(0)
    expect(milestones(ctx)).toHaveLength(0)
    expect(approvals(ctx).map((a) => a.subject.kind)).toEqual(["estimate"])
  })
})

describe("T-04 workstream isolation", () => {
  it("an HR stakeholder cannot reach IT items via UI query, file link or notification", async () => {
    const ctx = raw("u-diva", "p1")
    expect(ids(milestones(ctx))).not.toContain("m5")
    expect(ids(publications(ctx))).not.toContain("pub5")
    expect(ids(fullDocs("u-diva", "p1"))).not.toContain("doc8")
    expect(await fetchFile("u-diva", "doc8")).toBe(404)
    expect(await fetchFile("u-diva", "doc2")).toBe(200)

    as("u-tashi")
    ok(await changeMilestoneDate("p1", "m5", "2027-01-20", "Vendor workshop moved by Nova IT.", "team_adjustment"))
    expect(notesTo("u-arjun").some((n) => n.title.includes("IT systems"))).toBe(true)
    expect(notesTo("u-diva").some((n) => n.title.includes("IT systems"))).toBe(false)
  })
})

describe("T-05 Executive Director oversight", () => {
  it("sees Workstream and Client-wide content, no Team content, metadata only for Named", () => {
    const ctx = raw("u-rohit", "p1")
    expect(ids(publications(ctx))).toEqual(expect.arrayContaining(["pub1", "pub2", "pub5"]))
    expect(ids(fullDocs("u-rohit", "p1"))).toEqual(expect.arrayContaining(["doc1", "doc2", "doc8"]))
    expect(ids(fullDocs("u-rohit", "p1"))).not.toContain("doc3")
    expect(ids(stubs("u-rohit", "p1"))).toEqual(["doc4"])
    expect(publications(ctx).every((p) => p.teamRemarks === undefined)).toBe(true)
    expect(audit(ctx)).toHaveLength(0)
  })
})

describe("T-06 Named access requests", () => {
  it("declining keeps metadata only; granting unlocks content; both are logged", async () => {
    as("u-tashi")
    ok(await decideAccess("p1", "ar1", false))
    expect(ids(stubs("u-rohit", "p1"))).toContain("doc4")

    as("u-rohit")
    ok(await requestAccess("p1", "doc4", "Remuneration committee meets on Friday."))
    const req = db().accessRequests.find((r) => r.userId === "u-rohit" && r.state === "pending")!
    as("u-tashi")
    ok(await decideAccess("p1", req.id, true))
    expect(ids(fullDocs("u-rohit", "p1"))).toContain("doc4")

    const log = db().audit.filter((a) => a.projectId === "p1" && a.action.startsWith("Access"))
    expect(log.map((a) => a.action)).toEqual(expect.arrayContaining(["Access declined", "Access requested", "Access granted"]))
  })
})

describe("T-07 Director partitioning", () => {
  it("Director B cannot see Director A's other workstream or Named items", () => {
    const docs = ids(fullDocs("u-rajiv", "p1"))
    expect(docs).not.toContain("doc2")
    expect(docs).not.toContain("doc4")
    expect(ids(milestones(raw("u-rajiv", "p1")))).not.toContain("m4")
    expect(shell("u-tashi", "p3")).toBeNull()
  })
})

describe("T-08 Administrator has no content access", () => {
  it("is refused content; a self-grant logs a security event and alerts Directors", async () => {
    expect(shell("u-admin", "p1")).toBeNull()
    expect(await fetchFile("u-admin", "doc1")).toBe(404)

    as("u-admin")
    ok(await adminSelfGrant("p1"))
    expect(db().audit.some((a) => a.security && a.action.includes("self-grant"))).toBe(true)
    expect(notesTo("u-tashi").some((n) => n.tier === 1 && n.title.startsWith("Security alert"))).toBe(true)
    expect(isProjectStaff(raw("u-admin", "p1"))).toBe(false)
    refused(await postStatus("p1", { text: "Admin trying to post a status.", health: "on_track", explanation: "", nextSteps: "" }))
  })
})

describe("T-09 activity never widens access", () => {
  it("commenting gives a stakeholder no new access", async () => {
    const before = ids(fullDocs("u-diva", "p1"))
    as("u-diva")
    ok(await addComment("p1", { kind: "publication", id: "pub2" }, "Handbook will follow tomorrow.", "shared"))
    expect(ids(fullDocs("u-diva", "p1"))).toEqual(before)
    refused(await addComment("p1", { kind: "publication", id: "pub5" }, "Peeking at IT", "shared"))
  })
})

describe("T-10 Team content never reaches clients", () => {
  it("strips Team remarks and Team threads, and refuses Team comments from clients", async () => {
    const ctx = raw("u-gulzer", "p1")
    expect(publications(ctx).some((p) => p.teamRemarks)).toBe(false)
    expect(threads(ctx, "pub1").every((t) => t.audience === "shared")).toBe(true)
    expect(audit(ctx)).toHaveLength(0)
    as("u-gulzer")
    refused(await addComment("p1", { kind: "publication", id: "pub1" }, "Sneaky internal note", "team"))
  })
})

describe("T-11 invitations and presets", () => {
  it("an invited user has no access until verified, then only their workstream", async () => {
    as("u-admin")
    ok(await inviteUser({ name: "Neha Kulkarni", email: "neha.k@novaindustries.com", orgId: "org-nova", kind: "client_stakeholder", projectId: "p1", workstreamId: "ws-hr" }))
    const neha = db().users.find((u) => u.email === "neha.k@novaindustries.com")!
    expect(neha.status).toBe("invited")
    expect(shell(neha.id, "p1")).toBeNull()

    neha.status = "active" // email verified
    const docs = ids(fullDocs(neha.id, "p1"))
    expect(docs).toContain("doc2")
    expect(docs).not.toContain("doc8")
    refused(await inviteUser({ name: "Dup", email: "neha.k@novaindustries.com", orgId: "org-nova", kind: "client_stakeholder" }), /exists/)
  })
})

describe("T-12 removal is immediate", () => {
  it("ends the session, breaks file links and flags pending approvals", async () => {
    as("u-admin")
    ok(await setUserStatus("u-gulzer", "deactivated"))
    as("u-gulzer")
    expect(await getViewer()).toBeNull()
    expect(await fetchFile("u-gulzer", "doc1")).toBe(404)
    refused(await decideApproval("p1", "ap1", "approve", ""), /session/)
    expect(db().approvals.find((a) => a.id === "ap1")!.unavailableApproverIds).toContain("u-gulzer")
  })
})
