// Hours logging and the "at a glance" time totals.
import { describe, expect, it } from "vitest"
import { db } from "@/lib/store"
import { timeView } from "@/lib/data"
import { deleteHours, recordHours } from "@/lib/actions"
import { todayIso } from "@/lib/domain/rules"
import { as, ok, raw, refused } from "./support/session"

const entry = (hours = 6, date = todayIso()) => ({ date, hours, note: "Workshop" })

describe("Logging hours", () => {
  it("project staff log hours and the totals move", async () => {
    const before = timeView(raw("u-gulzer", "p1")).loggedHours
    as("u-priyanka")
    ok(await recordHours("p1", entry(6)))
    const t = timeView(raw("u-gulzer", "p1"))
    expect(t.loggedHours).toBe(before + 6)
    expect(t.agreedHours).toBe(260 * 8)
    expect(t.leftHours).toBe(260 * 8 - t.loggedHours)
  })

  it("clients, Executive Directors and non-members cannot log", async () => {
    as("u-gulzer")
    refused(await recordHours("p1", entry()), /staff/)
    as("u-rohit")
    refused(await recordHours("p1", entry()), /staff/)
    as("u-emma")
    refused(await recordHours("p1", entry()), /Not found/)
  })

  it("rejects future dates and impossible hours", async () => {
    as("u-sanjeev")
    refused(await recordHours("p1", entry(6, "2999-01-01")), /future/)
    refused(await recordHours("p1", entry(30)), /between/)
    refused(await recordHours("p1", entry(0)), /between/)
  })
})

describe("Who sees which entries", () => {
  it("clients see totals only; a team member sees their own; the CEO sees all", () => {
    expect(timeView(raw("u-gulzer", "p1")).entries).toHaveLength(0)
    expect(timeView(raw("u-diva", "p1")).entries).toHaveLength(0)
    expect(timeView(raw("u-diva", "p1")).agreedHours).toBe(260 * 8) // effort, not price
    expect(timeView(raw("u-sanjeev", "p1")).entries.every((t) => t.userId === "u-sanjeev")).toBe(true)
    const ceo = timeView(raw("u-tashi", "p1")).entries
    expect(new Set(ceo.map((t) => t.userId)).size).toBeGreaterThan(1)
  })

  it("a team member removes only their own entries; the CEO can remove anyone's", async () => {
    const other = db().timeEntries.find((t) => t.projectId === "p1" && t.userId === "u-priyanka")!
    as("u-sanjeev")
    refused(await deleteHours("p1", other.id), /Not found/)
    as("u-tashi")
    ok(await deleteHours("p1", other.id))
    expect(db().timeEntries.some((t) => t.id === other.id)).toBe(false)
  })
})
