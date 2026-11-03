import "server-only"
import { notFound, redirect } from "next/navigation"
import { getViewer, projectCtx } from "@/lib/data"
import { isClient, isProjectStaff } from "@/lib/access/audience"

export async function requireUser(kinds?: string[]) {
  const u = await getViewer()
  if (!u) redirect("/")
  if (kinds && !kinds.includes(u.kind)) redirect("/")
  return u
}

/** Staff project context. Unauthorised and non-existent look identical (404). */
export async function staffProject(projectId: string) {
  const u = await requireUser(["director", "team"])
  const ctx = projectCtx(u, projectId)
  if (!ctx || !isProjectStaff(ctx)) notFound()
  return ctx
}

export async function clientProject(projectId: string) {
  const u = await requireUser(["exec", "client_lead", "client_stakeholder"])
  const ctx = projectCtx(u, projectId)
  if (!ctx || !isClient(u)) notFound()
  return ctx
}
