import "server-only"
import { db } from "@/lib/store"
import { ROLE_LABEL } from "@/lib/domain/rules"

/** Options for the New project form (people and organisations only — no project content). */
export function projectFormOptions() {
  const d = db()
  const active = d.users.filter((u) => u.status === "active")
  return {
    orgs: d.orgs.filter((o) => o.kind === "client").map((o) => ({ id: o.id, name: o.name, code: o.code })),
    directors: active.filter((u) => u.kind === "director").map((u) => ({ id: u.id, name: u.name })),
    staff: active.filter((u) => u.kind === "director" || u.kind === "team").map((u) => ({ id: u.id, name: u.name, detail: ROLE_LABEL[u.kind] })),
    clients: active.filter((u) => u.kind === "client_lead" || u.kind === "client_stakeholder").map((u) => ({ id: u.id, name: u.name, orgId: u.orgId })),
  }
}
