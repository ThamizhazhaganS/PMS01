import { ShieldCheck } from "lucide-react"
import { db } from "@/lib/store"
import { requireUser } from "@/lib/page-ctx"
import { ROLE_LABEL, LIFECYCLE_LABEL } from "@/lib/domain/rules"
import { Pill } from "@/components/shared/badges"
import { PageTitle, Section } from "@/components/shared/ui"
import { InviteDialog, OrgDialog, UserStatusButton } from "@/components/admin/admin-controls"
import { OrgExplorer } from "@/components/admin/org-explorer"
import { userName } from "@/lib/data"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export default async function Admin() {
  const admin = await requireUser(["admin"])
  const d = db()
  const orgs = d.orgs
  const projects = d.projects.map((p) => ({ id: p.id, name: p.name, code: p.code, orgId: p.clientOrgId, lifecycle: p.lifecycle, cancelRequest: ["cancelled", "closed", "archived"].includes(p.lifecycle) ? undefined : p.cancelRequest, workstreams: d.workstreams.filter((w) => w.projectId === p.id).map((w) => ({ id: w.id, name: w.name })) }))
  return (
    <>
      <PageTitle eyebrow="Morphoverse · Platform" title="Organisations & users" action={<div className="flex flex-wrap gap-2"><OrgDialog /><Link href="/admin/projects/new" className={buttonVariants({ size: "sm", variant: "outline" })}>New project</Link><InviteDialog orgs={orgs} projects={projects} /></div>}>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4 text-ok" /> You manage accounts, not content. Project documents, meetings, estimates and comments are not visible here.</span>
      </PageTitle>

      <OrgExplorer
        orgs={orgs.map((o) => ({
          id: o.id,
          name: o.name,
          code: o.code,
          kind: o.kind === "agency" ? "Consulting firm" : "Client organisation",
          people: d.users.filter((u) => u.orgId === o.id).map((u) => ({ id: u.id, name: u.name, role: ROLE_LABEL[u.kind] })),
          projects: projects
            .filter((p) => p.orgId === o.id)
            .map((p) => ({
              id: p.id,
              name: p.name,
              code: p.code,
              state: LIFECYCLE_LABEL[p.lifecycle],
              granted: d.memberships.some((m) => m.projectId === p.id && m.userId === admin.id),
              cancelRequest: p.cancelRequest && { by: userName(p.cancelRequest.by), reason: p.cancelRequest.reason },
            })),
        }))}
      />

      <Section title={`Users (${d.users.length})`} className="mt-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 font-medium">User</th><th className="py-2 font-medium">Organisation</th><th className="py-2 font-medium">Role</th><th className="py-2 font-medium">Projects</th><th className="py-2 font-medium">Status</th><th /></tr></thead>
            <tbody>
              {d.users.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-3"><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                  <td className="py-2.5 pr-3 text-xs">{orgs.find((o) => o.id === u.orgId)?.name}</td>
                  <td className="py-2.5 pr-3 text-xs">{ROLE_LABEL[u.kind]}</td>
                  <td className="py-2.5 pr-3 text-xs">{d.memberships.filter((m) => m.userId === u.id).length}</td>
                  <td className="py-2.5 pr-3"><Pill tone={u.status === "active" ? "ok" : u.status === "invited" ? "info" : "bad"}>{u.status}</Pill></td>
                  <td className="py-2.5 text-right">{u.id !== admin.id && <UserStatusButton id={u.id} status={u.status} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}
