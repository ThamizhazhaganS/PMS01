import { beforeEach, vi } from "vitest"
import { resetDb } from "@/lib/store"
import { session } from "./session"

// The signed-in user comes from the pp_user cookie; tests set it via `as()`.
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "pp_user" && session.userId ? { name, value: session.userId } : undefined),
    set: (_name: string, value: string) => {
      session.userId = value
    },
  }),
}))

vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`)
  },
  notFound: () => {
    throw new Error("NOT_FOUND")
  },
}))

beforeEach(() => {
  resetDb()
  session.userId = "u-sarah"
})
