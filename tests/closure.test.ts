// T-25 and REQ-CLS: closure checklist, Tier A final acceptance, feedback, read-only archive.
import { describe, expect, it } from "vitest"
import { db } from "@/lib/store"
import { needsYou } from "@/lib/data"
import { archiveProject, decideApproval, finalizeClosure, postStatus, reopenProject, requestFinalAcceptance, setActionState, setClosureItem, startClosing, submitSurvey } from "@/lib/actions"
import { as, ok, refused, user } from "./support/session"

const p5 = () => db().projects.find((p) => p.id === "p5")!
const status = { text: "All deliverables accepted; handing over.", health: "on_track" as const, explanation: "", nextSteps: "Closure." }

describe("starting closure", () => {
  it("needs every milestone accepted and no open change requests", async () => {
    refused(await startClosing("p1"), /milestone/)
    as("u-sanjeev")
    refused(await startClosing("p5"), /Owner/)
    as("u-tashi")
    ok(await startClosing("p5"))
    expect(p5().lifecycle).toBe("closing")
    expect(p5().closure!.items.map((i) => i.state)).toEqual(Array(5).fill("pending"))
  })
})

describe("T-25 closing a project", () => {
  it("cannot close with Pending items; final acceptance is Tier A; closed is read-only", async () => {
    ok(await startClosing("p5"))
    refused(await finalizeClosure("p5"), /Pending/)

    // System checks behind "Met"
    refused(await setClosureItem("p5", "actions", "met"), /open actions/)
    ok(await setActionState("p5", "a6", "done"))
    ok(await setClosureItem("p5", "actions", "met"))
    ok(await setClosureItem("p5", "deliverables", "met"))
    refused(await setClosureItem("p5", "final_status", "met"), /final status/)
    ok(await postStatus("p5", status))
    ok(await setClosureItem("p5", "final_status", "met"))
    refused(await setClosureItem("p5", "final_docs", "waived", "short"), /reason/)
    ok(await setClosureItem("p5", "final_docs", "waived", "Final pack delivered by email at the client's request."))

    refused(await setClosureItem("p5", "feedback", "met"), /survey/)
    expect(needsYou(user("u-gulzer"), "p5").map((n) => n.kind)).toContain("survey")
    as("u-diva")
    refused(await submitSurvey("p5", { skip: true }), /Client Lead/)
    as("u-gulzer")
    refused(await submitSurvey("p5", { overall: 6, usefulness: 4, clarity: 4, timeline: 4, responsiveness: 4, comments: "" }), /1 to 5/)
    ok(await submitSurvey("p5", { overall: 5, usefulness: 4, clarity: 5, timeline: 4, responsiveness: 5, comments: "Great team." }))
    as("u-tashi")
    ok(await setClosureItem("p5", "feedback", "met"))

    // Checklist done, but no final acceptance yet
    refused(await finalizeClosure("p5"), /Final acceptance/)
    ok(await requestFinalAcceptance("p5"))
    const final = db().approvals.find((a) => a.id === p5().closure!.finalApprovalId)!
    expect(final.tier).toBe("A")
    as("u-gulzer")
    refused(await decideApproval("p5", final.id, "approve", ""), /verification/)
    ok(await decideApproval("p5", final.id, "approve", "Accepted.", "123456"))

    as("u-tashi")
    ok(await finalizeClosure("p5"))
    expect(p5().lifecycle).toBe("closed")
    expect(p5().closure!.finalizedAt).toBeTruthy()

    // Read-only afterwards, and the closure record is locked
    refused(await postStatus("p5", status), /read-only/)
    refused(await setClosureItem("p5", "deliverables", "pending"), /read-only/)
    ok(await archiveProject("p5"))
    expect(p5().lifecycle).toBe("archived")
  })

  it("reopening preserves the previous closure record", async () => {
    ok(await startClosing("p5"))
    p5().lifecycle = "closed"
    ok(await reopenProject("p5", "Client asked for an extra supplier tier."))
    expect(p5().lifecycle).toBe("active")
    expect(p5().closure).toBeUndefined()
    expect(p5().previousClosures).toHaveLength(1)
  })
})
