import { CircleAlert, MailQuestion } from "lucide-react"
import { db } from "@/lib/store"
import { requireUser } from "@/lib/page-ctx"
import { ROLE_LABEL, LIFECYCLE_LABEL, fmtDate } from "@/lib/domain/rules"
import { PageTitle } from "@/components/shared/ui"
import { ConfirmCancelButton, InviteDialog } from "@/components/admin/admin-controls"
import { AdminDirectory, NewMenu } from "@/components/admin/admin-directory"
import { userName } from "@/lib/data"

export default async function Admin() {
  const admin = await requireUser(["admin"])
  const d = db()
  const orgs = d.orgs
  const projects = d.projects.map((p) => ({ id: p.id, name: p.name, code: p.code, orgId: p.clientOrgId, lifecycle: p.lifecycle, cancelRequest: ["cancelled", "closed", "archived"].includes(p.lifecycle) ? undefined : p.cancelRequest, workstreams: d.workstreams.filter((w) => w.projectId === p.id).map((w) => ({ id: w.id, name: w.name })) }))
  const cancellations = projects.filter((p) => p.cancelRequest)
  const invited = d.users.filter((u) => u.status === "invited")
  // One person can hold two logins (e.g. Admin and Team member); say so instead of looking like a duplicate.
  const sameName = (name: string) => d.users.filter((u) => u.name === name).length > 1

  return (
    <>
      <PageTitle
        title="Organisations and users"
        action={
          <div className="flex flex-wrap gap-2">
            <NewMenu />
            <InviteDialog orgs={orgs} projects={projects} />
          </div>
        }
      >
        Manage client organisations and who can sign in. Project content is never shown here.
      </PageTitle>

      {(cancellations.length > 0 || invited.length > 0) && (
        <section className="mb-5 rounded-2xl border border-warn/40 bg-warn-soft/40 p-5" aria-labelledby="todo-h">
          <h2 id="todo-h" className="text-base font-semibold">Needs your action</h2>
          <ul className="mt-2 divide-y divide-warn/20">
            {cancellations.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <CircleAlert className="size-4 shrink-0 text-bad" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Cancel {p.name}?</p>
                  <p className="text-xs text-muted-foreground">
                    Requested by {userName(p.cancelRequest!.by)} on {fmtDate(p.cancelRequest!.at)}: “{p.cancelRequest!.reason}”. Your confirmation is the second check.
                  </p>
                </div>
                <ConfirmCancelButton projectId={p.id} />
              </li>
            ))}
            {invited.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                <MailQuestion className="size-4 shrink-0 text-info" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{u.name} has not accepted the invitation yet</p>
                  <p className="text-xs text-muted-foreground">{u.email} · {ROLE_LABEL[u.kind]} · invitations expire after 7 days</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AdminDirectory
        adminId={admin.id}
        orgs={orgs.map((o) => ({ id: o.id, name: o.name, kind: o.kind, users: d.users.filter((u) => u.orgId === o.id).length, projects: d.projects.filter((p) => p.clientOrgId === o.id).length }))}
        users={d.users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          orgId: u.orgId,
          role: ROLE_LABEL[u.kind],
          projects: d.memberships.filter((m) => m.userId === u.id).length,
          status: u.status,
          note: sameName(u.name) ? `${ROLE_LABEL[u.kind]} login` : undefined,
        }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name, code: p.code, orgId: p.orgId, state: LIFECYCLE_LABEL[p.lifecycle], granted: d.memberships.some((m) => m.projectId === p.id && m.userId === admin.id) }))}
      />
    </>
  )
}
