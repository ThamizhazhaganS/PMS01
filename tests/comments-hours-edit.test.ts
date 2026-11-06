// Editing hours, and comment edit / resolve / make-an-action.
import { describe, expect, it } from "vitest"
import { db } from "@/lib/store"
import { actions, recentComments, threadViews, timeView } from "@/lib/data"
import { addComment, commentToAction, editComment, setThreadResolved, updateHours } from "@/lib/actions"
import { todayIso } from "@/lib/domain/rules"
import { as, ok, raw, refused } from "./support/session"

describe("Editing hours", () => {
  it("a team member corrects their own entry; the CEO can correct anyone's", async () => {
    const mine = db().timeEntries.find((t) => t.projectId === "p1" && t.userId === "u-sanjeev")!
    const other = db().timeEntries.find((t) => t.projectId === "p1" && t.userId === "u-priyanka")!
    as("u-sanjeev")
    ok(await updateHours("p1", mine.id, { date: mine.date, hours: 3, note: "Corrected" }))
    expect(db().timeEntries.find((t) => t.id === mine.id)).toMatchObject({ hours: 3, note: "Corrected" })
    refused(await updateHours("p1", other.id, { date: other.date, hours: 2, note: "" }), /Not found/)
    refused(await updateHours("p1", mine.id, { date: "2999-01-01", hours: 2, note: "" }), /future/)
    as("u-tashi")
    ok(await updateHours("p1", other.id, { date: todayIso(), hours: 5, note: "" }))
  })

  it("the CEO gets hours per person; team members and clients do not", () => {
    expect(timeView(raw("u-tashi", "p1")).byPerson.length).toBeGreaterThan(1)
    expect(timeView(raw("u-sanjeev", "p1")).byPerson).toHaveLength(0)
    expect(timeView(raw("u-gulzer", "p1")).byPerson).toHaveLength(0)
  })
})

describe("Comments", () => {
  it("only the author edits a comment; the old wording is kept in the history", async () => {
    as("u-tashi")
    refused(await editComment("p1", "th1", "c1", "Changed by someone else"), /own comments/)
    as("u-gulzer")
    ok(await editComment("p1", "th1", "c1", "Can we have the slides in our board format?"))
    const c = threadViews(raw("u-gulzer", "p1"), "pub1").find((t) => t.id === "th1")!.comments.find((x) => x.id === "c1")!
    expect(c.body).toBe("Can we have the slides in our board format?")
    expect(c.editedAt).toBeDefined()
    expect(db().audit.at(-1)).toMatchObject({ action: "Comment edited" })
  })

  it("clients cannot touch Team-only threads, and only staff resolve", async () => {
    as("u-gulzer")
    refused(await editComment("p1", "th2", "c3", "x x"), /Not found/)
    refused(await setThreadResolved("p1", "th1", true), /resolves/)
    as("u-sanjeev")
    ok(await setThreadResolved("p1", "th1", true))
    expect(db().threads.find((t) => t.id === "th1")!.resolved).toBe(true)
  })

  it("staff turn a comment into an action with the thread's audience", async () => {
    as("u-priyanka")
    ok(await commentToAction("p1", "th2", "c3"))
    const a = db().actions.at(-1)!
    expect(a).toMatchObject({ ownerId: "u-priyanka", audience: { kind: "team" }, source: { kind: "comment", id: "c3" } })
    // A Team-only action never reaches the client.
    expect(actions(raw("u-gulzer", "p1")).some((x) => x.id === a.id)).toBe(false)
    as("u-gulzer")
    refused(await commentToAction("p1", "th1", "c1"), /Not allowed/)
  })
})

describe("Comment alerts and Recent comments", () => {
  it("a shared comment alerts the client; a Team-only one never does", async () => {
    const notes = (userId: string) => db().notifications.filter((n) => n.userId === userId && n.title.includes("commented"))
    as("u-tashi")
    ok(await addComment("p1", { kind: "publication", id: "pub1" }, "We will send the board deck on Friday.", "shared"))
    expect(notes("u-gulzer")).toHaveLength(1)
    expect(notes("u-gulzer")[0].href).toBe("/portal/projects/p1/documents")
    expect(notes("u-sanjeev")[0].href).toBe("/w/projects/p1/publications")
    expect(notes("u-tashi")).toHaveLength(0) // not the author

    ok(await addComment("p1", { kind: "publication", id: "pub1" }, "Internal: keep the deck short.", "team"))
    expect(notes("u-gulzer")).toHaveLength(1)
    expect(notes("u-sanjeev")).toHaveLength(2)
  })

  it("clients see only shared comments in Recent comments; staff see both", () => {
    expect(recentComments(raw("u-gulzer", "p1")).every((c) => !c.teamOnly)).toBe(true)
    expect(recentComments(raw("u-tashi", "p1")).some((c) => c.teamOnly)).toBe(true)
  })
})
