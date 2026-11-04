import { db } from "@/lib/store"
import { getViewerId, notificationsFor } from "@/lib/data"
import { ROLE_LABEL } from "@/lib/domain/rules"
import { DevBarClient } from "./dev-bar-client"

/** Persistent dev-only role switcher + outbox. Not part of the product UI. */
export async function DevBar() {
  const currentId = await getViewerId()
  const d = db()
  const users = d.users
    .filter((u) => u.status !== "invited")
    .map((u) => ({
      id: u.id,
      name: u.name,
      role: ROLE_LABEL[u.kind],
      org: d.orgs.find((o) => o.id === u.orgId)?.name ?? "",
      extra: u.extra,
      status: u.status,
    }))
  const emails = [...d.emails].sort((a, b) => b.at.localeCompare(a.at))
  const notes = notificationsFor(currentId).slice(0, 30)
  return <DevBarClient users={users} currentId={currentId} emails={emails} notes={notes} digestOn={!d.digestOptOut[currentId]} />
}
