import { expect } from "vitest"
import { db } from "@/lib/store"
import { ctxFor, projectCtx } from "@/lib/data"
import type { Result } from "@/lib/actions"

export const session: { userId: string | null } = { userId: "u-tashi" }

/** Act as a seeded test user for the following server-action calls. */
export function as(userId: string) {
  session.userId = userId
}

export const user = (id: string) => db().users.find((u) => u.id === id)!

/** Shell-checked context, or null when the user cannot see the project at all. */
export const shell = (userId: string, projectId: string) => projectCtx(user(userId), projectId)

/** Raw context (no shell check) for asserting filtered collections are empty. */
export const raw = (userId: string, projectId: string) => ctxFor(user(userId), projectId)!

export function ok(r: Result) {
  if (!r.ok) throw new Error(`Expected ok, got: ${r.error}`)
  return r
}

export function refused(r: Result, match?: RegExp) {
  expect(r.ok, "expected the server to refuse").toBe(false)
  if (match && !r.ok) expect(r.error).toMatch(match)
}

export const emailsTo = (userId: string) => db().emails.filter((e) => e.userId === userId)
export const notesTo = (userId: string) => db().notifications.filter((n) => n.userId === userId)
