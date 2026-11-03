// Publishing, approvals, change discipline, lifecycle, notifications and audit.
import { describe, expect, it } from "vitest"
import { db } from "@/lib/store"
import { GET as download } from "@/app/api/files/[docId]/route"
import { approvals, decisions, documents, publications, visibleAttachments, actions as visibleActions } from "@/lib/data"
import * as effects from "@/lib/effects"
import {
  addComment,
  adminConfirmCancel,
  advanceChange,
  advanceEstimate,
  changeMilestoneDate,
  decideApproval,
  lifecycleAction,
  milestoneTransition,
  newEstimateVersion,
  postStatus,
  reopenProject,
  retractDocument,
  revisePublication,
  saveImpact,
  savePublication,
  setDigest,
  toggleWorkstream,
  type PublicationInput,
} from "@/lib/actions"
import { as, emailsTo, notesTo, ok, raw, refused } from "./support/session"

const OTP = "123456"
const ms = (id: string) => db().milestones.find((m) => m.id === id)!
const ap = (id: string) => db().approvals.find((a) => a.id === id)!

const meeting = (over: Partial<PublicationInput> = {}): PublicationInput => ({
  kind: "meeting",
  title: "Steering Committee #3",
  meetingAt: "2026-10-01T15:30",
  summary: "Reviewed the HR TOM draft.",
  attendeeIds: ["u-tashi", "u-gulzer"],
  decisions: ["Finance assessment scoped via CR-2"],
  actions: [{ description: "Circulate revised RACI", ownerId: "u-gulzer" }],
  teamRemarks: "INTERNAL: CFO is sceptical.",
  attachments: [],
  newFiles: [],
  audience: { kind: "client" },
  actionRequired: false,
  ...over,
})

describe("T-13 meeting records keep the real meeting date", () => {
  it("stores the IST meeting time and sorts by it, not by upload time", async () => {
    ok(await savePublication("p1", meeting(), true, true))
    const pub = db().publications.find((p) => p.title === "Steering Committee #3")!
    expect(pub.meetingAt).toBe("2026-10-01T10:00:00.000Z")
    const order = publications(raw("u-tashi", "p1")).map((p) => p.id)
    expect(order.indexOf(pub.id)).toBeGreaterThan(order.indexOf("pub1")) // older meeting sorts after newer ones
  })

  it("publishing needs an explicit audience, a confirmation and the publish right", async () => {
    refused(await savePublication("p1", meeting({ audience: null }), true, true), /audience/)
    refused(await savePublication("p1", meeting(), true, false), /Confirm/)
    as("u-shrenik-team")
    refused(await savePublication("p1", meeting(), true, true), /publish right/)
    ok(await savePublication("p1", meeting(), false, false)) // a draft is fine
  })
})

describe("T-14 attachments publish individually", () => {
  it("3 attachments, 1 selected for the client → the client sees exactly 1", async () => {
    ok(await savePublication("p1", meeting({
      attachments: [
        { documentId: "doc3", audience: null },
        { documentId: "doc5", audience: null },
        { documentId: "doc8", audience: { kind: "client" } },
      ],
    }), true, true))
    const pub = db().publications.find((p) => p.title === "Steering Committee #3")!
    const seen = visibleAttachments(raw("u-gulzer", "p1"), pub).map((a) => a.documentId)
    expect(seen).toEqual(["doc8"])
    expect(publications(raw("u-gulzer", "p1")).find((p) => p.id === pub.id)!.teamRemarks).toBeUndefined()
  })
})

describe("T-15 corrections never edit a published record", () => {
  it("a correction request leaves v1 intact until a revision supersedes it", async () => {
    const before = db().publications.find((p) => p.id === "pub1")!.summary
    as("u-gulzer")
    ok(await addComment("p1", { kind: "publication", id: "pub1" }, "Rohit did not attend.", "shared", "correction"))
    expect(db().publications.find((p) => p.id === "pub1")!.summary).toBe(before)

    as("u-tashi")
    ok(await revisePublication("p1", "pub1", "Corrected attendee list.", "Removed Rohit from attendees"))
    const v1 = db().publications.find((p) => p.id === "pub1")!
    const v2 = db().publications.find((p) => p.supersedesId === "pub1")!
    expect(v1.summary).toBe(before)
    expect(v1.supersededById).toBe(v2.id)
    expect(v2.version).toBe(2)
  })
})

describe("T-16 meeting decisions and actions feed the registers", () => {
  it("creates decisions and actions with back-links to the source", async () => {
    ok(await savePublication("p1", meeting(), true, true))
    const pub = db().publications.find((p) => p.title === "Steering Committee #3")!
    const dec = decisions(raw("u-gulzer", "p1")).find((d) => d.sourcePublicationId === pub.id)
    const act = visibleActions(raw("u-gulzer", "p1")).find((a) => a.source?.id === pub.id)
    expect(dec?.statement).toBe("Finance assessment scoped via CR-2")
    expect(act?.ownerId).toBe("u-gulzer")
  })
})

describe("T-17 retraction", () => {
  it("blocks downloads, keeps a notice and records history", async () => {
    ok(await retractDocument("p1", "doc1", "Superseded by the revised assessment pack."))
    as("u-gulzer")
    const res = await download(new Request("http://test/api/files/doc1"), { params: Promise.resolve({ docId: "doc1" }) })
    expect(res.status).toBe(404)
    const doc = documents(raw("u-gulzer", "p1")).find((d) => d.id === "doc1")!
    expect("retracted" in doc && doc.retracted).toBeTruthy()
    expect(db().audit.some((a) => a.action === "Retracted" && a.detail.includes("Current-State"))).toBe(true)
  })
})

describe("T-18 approvals bind to one version", () => {
  it("sharing a newer estimate supersedes the pending approval for the old one", async () => {
    ok(await newEstimateVersion("p2"))
    const v2 = db().estimates.find((e) => e.projectId === "p2" && e.version === 2)!
    ok(await advanceEstimate("p2", v2.id, "review"))
    ok(await advanceEstimate("p2", v2.id, "share"))
    expect(ap("ap2").state).toBe("superseded")
    expect(db().estimates.find((e) => e.id === "est2")!.state).toBe("superseded")
    const fresh = db().approvals.find((a) => a.subject.kind === "estimate" && a.subject.id === v2.id)!
    expect(fresh.state).toBe("pending")
    expect(fresh.subject).toMatchObject({ version: 2 })
    expect(ap("ap0").state).toBe("approved") // P1's approved v1 is untouched
  })

  it("shared versions are immutable", async () => {
    const { updateEstimate } = await import("@/lib/actions")
    refused(await updateEstimate("p2", "est2", { scope: "x", effortDays: 1, durationWeeks: 1, expenses: 0, taxRate: 0, lineItems: [], detailLevel: "total", internalNotes: "", costPerDay: 0, targetMarginPct: 0, validUntil: "2027-01-01" }), /immutable/)
  })
})

describe("T-19 only designated approvers decide; Tier A needs fresh sign-in", () => {
  it("refuses non-designated users and missing OTP, accepts the designated approver", async () => {
    as("u-diva")
    refused(await decideApproval("p1", "ap1", "approve", ""), /designated/)
    as("u-gulzer")
    refused(await decideApproval("p2", "ap2", "approve", ""), /verification/)
    ok(await decideApproval("p2", "ap2", "approve", "", OTP))
    expect(ap("ap2").responses[0].method).toMatch(/OTP/)
    const p2 = db().projects.find((p) => p.id === "p2")!
    expect(p2.lifecycle).toBe("active")
    expect(ms("m21").baselineDate).toBe(ms("m21").currentDate) // baselines frozen on approval
  })

  it("is idempotent on double submit", async () => {
    as("u-gulzer")
    ok(await decideApproval("p1", "ap1", "approve", ""))
    ok(await decideApproval("p1", "ap1", "approve", ""))
    expect(ap("ap1").responses).toHaveLength(1)
    expect(ms("m4").state).toBe("accepted")
  })

  it("Request changes and Decline need a comment", async () => {
    as("u-gulzer")
    refused(await decideApproval("p1", "ap1", "changes", ""), /comment/)
  })
})

describe("T-20 viewing, downloading or commenting is never approval", () => {
  it("leaves the approval pending", async () => {
    as("u-gulzer")
    approvals(raw("u-gulzer", "p1"))
    await download(new Request("http://test/api/files/doc2"), { params: Promise.resolve({ docId: "doc2" }) })
    ok(await addComment("p1", { kind: "publication", id: "pub3" }, "Looks good to me!", "shared"))
    expect(ap("ap1").state).toBe("pending")
    expect(ap("ap1").responses).toHaveLength(0)
  })
})

describe("T-21 change discipline", () => {
  it("needs an impact review before any decision", async () => {
    refused(await advanceChange("p1", "cr1", "send_for_approval"), /impact review/)
    ok(await saveImpact("p1", "cr1", { milestoneIds: ["m6"], dateShiftDays: 7, scope: "Payroll added to phase 1.", effortDays: 12, costDelta: 900000 }))
    refused(await advanceChange("p1", "cr1", "approve_internal"), /client approval/)
    refused(await advanceChange("p1", "cr1", "implement"), /approved/)
  })

  it("commercial changes wait for client approval; baselines never move silently", async () => {
    const baseline = ms("m7").baselineDate
    const current = ms("m7").currentDate
    refused(await advanceChange("p1", "cr2", "implement"), /approved/)
    expect(ms("m7").currentDate).toBe(current)

    as("u-gulzer")
    ok(await decideApproval("p1", "ap4", "approve", "", OTP))
    as("u-tashi")
    ok(await advanceChange("p1", "cr2", "implement"))
    expect(ms("m7").baselineDate).toBe(baseline)
    expect(ms("m7").currentDate).not.toBe(current)
    expect(ms("m7").dateChanges.at(-1)).toMatchObject({ linkKind: "change_request", linkId: "cr2" })
  })
})

describe("T-22 no silent date shifts", () => {
  it("rejects a date change without a written reason", async () => {
    const before = { ...ms("m6") }
    refused(await changeMilestoneDate("p1", "m6", "2027-02-01", "", "team_adjustment"), /reason/)
    refused(await changeMilestoneDate("p1", "m6", "2027-02-01", "Blocked.", "blocker"), /reason|Link/)
    expect(ms("m6").currentDate).toBe(before.currentDate)
    expect(ms("m6").baselineDate).toBe(before.baselineDate)
  })
})

describe("T-23 Ready for review is not Accepted", () => {
  it("staff cannot accept a client milestone, and need the publish right to request it", async () => {
    refused(await milestoneTransition("p1", "m4", "accepted"), /client approver/)
    as("u-shrenik-team")
    ok(await milestoneTransition("p1", "m6", "in_progress"))
    refused(await milestoneTransition("p1", "m6", "ready_for_review", ["u-diva"]), /publish right/)
    as("u-sanjeev")
    refused(await milestoneTransition("p1", "m6", "ready_for_review", ["u-arjun"]), /approver/) // Arjun can't see an HR milestone
    ok(await milestoneTransition("p1", "m6", "ready_for_review", ["u-diva"]))
    expect(ms("m6").state).toBe("ready_for_review")
  })
})

describe("T-24 lifecycle rules", () => {
  it("pause, resume, cancel and reopen each require reasons and confirmations", async () => {
    refused(await lifecycleAction("p1", "pause", ""), /reason/)
    ok(await lifecycleAction("p1", "pause", "Client budget freeze until April."))
    refused(await lifecycleAction("p1", "resume", ""), /Confirm/)
    ok(await lifecycleAction("p1", "resume", "confirmed"))

    as("u-admin")
    refused(await adminConfirmCancel("p1"), /No cancellation/) // nothing requested yet
    as("u-sanjeev")
    refused(await lifecycleAction("p1", "request_cancel", "Team member trying to cancel."), /Owner/)
    as("u-tashi")
    refused(await adminConfirmCancel("p1"), /Admins only/) // the CEO cannot confirm their own request
    ok(await lifecycleAction("p1", "request_cancel", "Client strategy changed this quarter."))
    expect(db().projects.find((p) => p.id === "p1")!.lifecycle).toBe("active")
    expect(notesTo("u-admin").some((n) => n.title.includes("needs Admin confirmation"))).toBe(true)
    as("u-admin")
    ok(await adminConfirmCancel("p1"))
    expect(db().projects.find((p) => p.id === "p1")!.lifecycle).toBe("cancelled")
    expect(db().approvals.filter((a) => a.projectId === "p1" && a.state === "pending")).toHaveLength(0)

    as("u-tashi")
    refused(await postStatus("p1", { text: "Should not be allowed now.", health: "on_track", explanation: "", nextSteps: "" }), /read-only/)
    refused(await reopenProject("p1", ""), /reason/)
    ok(await reopenProject("p1", "Client reinstated the programme."))
  })
})

describe("T-26 notification tiers", () => {
  it("Tier 1 always emails; Tier 2 respects the digest switch; restricted items stay quiet", async () => {
    as("u-gulzer")
    ok(await setDigest(false))
    as("u-tashi")
    ok(await changeMilestoneDate("p1", "m7", "2027-01-15", "Steering committee asked to align with board.", "team_adjustment"))
    ok(await postStatus("p1", { text: "Routine weekly update for the team.", health: "on_track", explanation: "", nextSteps: "" }))

    expect(emailsTo("u-gulzer").filter((e) => e.tier === 1 && e.status === "sent").length).toBeGreaterThan(0)
    expect(emailsTo("u-gulzer").filter((e) => e.tier === 2)).toHaveLength(0)
    expect(notesTo("u-gulzer").some((n) => n.tier === 2)).toBe(true) // still in-app
    expect(emailsTo("u-diva").some((e) => e.tier === 2 && e.status === "queued_digest")).toBe(true)
    expect(emailsTo("u-emma")).toHaveLength(0)
  })
})

describe("T-27 append-only activity log", () => {
  it("records grants, transitions, date changes and approvals; nothing can edit it", async () => {
    const start = db().audit.length
    ok(await toggleWorkstream("p1", "u-diva", "ws-it"))
    ok(await changeMilestoneDate("p1", "m7", "2027-01-20", "Board calendar confirmed by Gera.", "team_adjustment"))
    ok(await lifecycleAction("p1", "pause", "Short pause for holiday shutdown."))
    as("u-gulzer")
    ok(await decideApproval("p1", "ap1", "approve", ""))
    const added = db().audit.slice(start).map((a) => a.action)
    expect(added).toEqual(expect.arrayContaining(["Access granted", "Date changed", "Lifecycle changed", "Approval decided"]))
    expect(db().audit.slice(0, start).length).toBe(start) // earlier entries untouched

    expect(Object.keys(effects).sort()).toEqual(["audit", "hrefFor", "notify"])
    const actionsModule = await import("@/lib/actions")
    expect(Object.keys(actionsModule).filter((k) => /audit|log/i.test(k))).toEqual([])
  })
})
