import { db } from "@/lib/store"
import { requireUser } from "@/lib/page-ctx"
import { userName } from "@/lib/data"
import { fmtDateTime } from "@/lib/domain/rules"
import { PageTitle } from "@/components/shared/ui"
import { SecurityLog } from "@/components/admin/security-log"

export default async function Security() {
  await requireUser(["admin"])
  const d = db()
  const events = d.audit
    .filter((a) => a.security)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((e) => {
      const p = d.projects.find((x) => x.id === e.projectId)
      const actor = d.users.find((u) => u.id === e.actorId)
      // A project event belongs to that project's client; anything else to the actor's organisation.
      const orgId = p?.clientOrgId ?? actor?.orgId
      return {
        id: e.id,
        when: fmtDateTime(e.at),
        action: e.action,
        actor: userName(e.actorId),
        project: p?.code ?? "Platform",
        projectName: p?.name,
        org: d.orgs.find((o) => o.id === orgId)?.name ?? "Unknown (failed sign-ins)",
        detail: e.detail,
      }
    })
  return (
    <>
      <PageTitle eyebrow="Append-only" title="Security log">
        Invitations, deactivations, access grants and revocations, self-grants, View As sessions and failed sign-ins. Nothing here can be edited or deleted.
      </PageTitle>
      <SecurityLog events={events} />
    </>
  )
}
