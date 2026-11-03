import { ShieldCheck } from "lucide-react"
import { db } from "@/lib/store"
import { requireUser } from "@/lib/page-ctx"
import { ROLE_LABEL, LIFECYCLE_LABEL } from "@/lib/domain/rules"
import { Pill } from "@/components/shared/badges"
import { PageTitle, Section } from "@/components/shared/ui"
import { InviteDialog, OrgDialog, SelfGrantButton, UserStatusButton } from "@/components/admin/admin-controls"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export default async function Admin() {
  const admin = await requireUser(["admin"])
  const d = db()
  const orgs = d.orgs
  const projects = d.projects.map((p) => ({ id: p.id, name: p.name, code: p.code, orgId: p.clientOrgId, lifecycle: p.lifecycle, workstreams: d.workstreams.filter((w) => w.projectId === p.id).map((w) => ({ id: w.id, name: w.name })) }))
  return (
    <>
      <PageTitle eyebrow="Morphoverse · Platform" title="Organisations & users" action={<div className="flex flex-wrap gap-2"><OrgDialog /><Link href="/admin/projects/new" className={buttonVariants({ size: "sm", variant: "outline" })}>New project</Link><InviteDialog orgs={orgs} projects={projects} /></div>}>
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4 text-ok" /> You manage accounts, not content. Project documents, meetings, estimates and comments are not visible here.</span>
      </PageTitle>

      <div className="grid gap-5 lg:grid-cols-3">
        <Section title="Organisations" className="lg:col-span-1">
          <ul className="divide-y">
            {orgs.map((o) => (
              <li key={o.id} className="flex items-center justify-between py-2.5">
                <div>
                  <div className="text-sm font-medium">{o.name}</div>
                  <div className="text-xs text-muted-foreground">{o.kind === "agency" ? "Consulting firm" : "Client organisation"} · {d.users.filter((u) => u.orgId === o.id).length} users · {d.projects.filter((p) => p.clientOrgId === o.id).length} projects</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Project shells" eyebrow="Name and state only" className="lg:col-span-2">
          <ul className="divide-y">
            {projects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.code} · {orgs.find((o) => o.id === p.orgId)?.name} · {LIFECYCLE_LABEL[p.lifecycle]}</div>
                </div>
                <SelfGrantButton projectId={p.id} granted={d.memberships.some((m) => m.projectId === p.id && m.userId === admin.id)} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Self-granting access is logged as a security event and alerts the project&apos;s Directors immediately.</p>
        </Section>
      </div>

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
