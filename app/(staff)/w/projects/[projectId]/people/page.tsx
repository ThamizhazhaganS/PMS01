import Link from "next/link"
import { Check, Eye, Minus, ShieldAlert } from "lucide-react"
import { staffProject } from "@/lib/page-ctx"
import { accessRequests, audiencePeople, ctxFor, members, userName, workstreams } from "@/lib/data"
import { db } from "@/lib/store"
import { canManageAccess, canSeeAudience, canViewAs, isOwner, isRestrictedStub } from "@/lib/access/audience"
import { ROLE_LABEL, fmtDateTime, isStaffKind } from "@/lib/domain/rules"
import type { Audience } from "@/lib/domain/types"
import { Pill } from "@/components/shared/badges"
import { Initials, Section } from "@/components/shared/ui"
import { buttonVariants } from "@/components/ui/button"
import { AccessRequestButtons, PublishRightSwitch, RemoveMember, WorkstreamChips } from "@/components/staff/people-controls"

export default async function People({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await staffProject(projectId)
  const manage = canManageAccess(ctx)
  const ws = workstreams(projectId).map((w) => ({ id: w.id, name: w.name }))
  const mem = members(projectId)
  const people = audiencePeople(projectId)
  const named = db().documents.filter((d) => d.projectId === projectId && d.audience.kind === "named")
  const reqs = accessRequests(ctx).filter((r) => r.state === "pending")
  const cols: { label: string; aud: Audience }[] = [
    { label: "Team", aud: { kind: "team" } },
    ...ws.map((w) => ({ label: w.name, aud: { kind: "workstream", workstreamId: w.id } as Audience })),
    { label: "Client-wide", aud: { kind: "client" } },
  ]

  return (
    <div className="space-y-5">
      {reqs.length > 0 && (
        <Section title="Access requests" eyebrow="Logged — author or Owner decides">
          <ul className="divide-y">
            {reqs.map((r) => {
              const doc = db().documents.find((d) => d.id === r.documentId)
              const can = isOwner(ctx) || doc?.authorId === ctx.user.id
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="text-sm"><b>{userName(r.userId)}</b> requests <b>{doc?.title}</b><div className="text-xs text-muted-foreground">“{r.reason}” · {fmtDateTime(r.at)}</div></div>
                  {can ? <AccessRequestButtons projectId={projectId} id={r.id} /> : <span className="text-xs text-muted-foreground">Awaiting author/Owner</span>}
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      <Section title="Members & workstreams" eyebrow={manage ? "You can manage access — every change is logged" : "Read only — you don't have manage-access"}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 font-medium">Person</th><th className="py-2 font-medium">Project role · preset</th><th className="py-2 font-medium">Workstreams</th><th className="py-2 font-medium">Publish right</th><th /></tr></thead>
            <tbody>
              {mem.map(({ user, membership: m }) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <Initials name={user.name} />
                      <div><div className="font-medium">{user.name}{m.selfGranted && <Pill tone="bad" className="ml-1.5"><ShieldAlert className="size-3" /> Admin self-grant</Pill>}</div><div className="text-xs text-muted-foreground">{isStaffKind(user.kind) ? "Morphoverse" : "Nova Industries"} · {user.email}</div></div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-xs">{m.role.replace("_", " ")}<div className="text-muted-foreground">{m.preset}</div></td>
                  <td className="py-2.5 pr-3"><WorkstreamChips projectId={projectId} userId={user.id} all={ws} mine={m.role === "owner" ? ws.map((w) => w.id) : m.workstreamIds} editable={manage && m.role !== "owner"} /></td>
                  <td className="py-2.5 pr-3">{m.role === "team" ? <PublishRightSwitch projectId={projectId} userId={user.id} value={m.publishRight} editable={manage} /> : <span className="text-xs text-muted-foreground">{m.publishRight ? "Yes (Director)" : "—"}</span>}</td>
                  <td className="py-2.5 text-right">
                    <div className="flex justify-end gap-1.5">
                      {canViewAs(ctx) && !isStaffKind(user.kind) && (
                        <Link href={`/w/projects/${projectId}/view-as/${user.id}`} className={buttonVariants({ size: "xs", variant: "outline" })}><Eye /> View as</Link>
                      )}
                      {manage && m.role !== "owner" && <RemoveMember projectId={projectId} userId={user.id} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Access matrix" eyebrow="Effective access per audience — computed by the same server rules">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Person</th>
                {cols.map((c) => <th key={c.label} className="py-2 text-center font-medium">{c.label}</th>)}
                {named.map((d) => <th key={d.id} className="py-2 text-center font-medium">Named: {d.title}</th>)}
              </tr>
            </thead>
            <tbody>
              {people.map(({ user }) => {
                const c = ctxFor(user, projectId)!
                return (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="py-2 pr-3"><div className="font-medium">{user.name}</div><div className="text-xs text-muted-foreground">{ROLE_LABEL[user.kind]}{user.kind === "exec" && " · oversight"}</div></td>
                    {cols.map((col) => <td key={col.label} className="py-2 text-center"><Mark on={canSeeAudience(c, col.aud, "nobody")} /></td>)}
                    {named.map((d) => (
                      <td key={d.id} className="py-2 text-center">
                        {canSeeAudience(c, d.audience, d.authorId) ? <Mark on /> : isRestrictedStub(c, d.audience, d.authorId) ? <span className="text-[11px] text-muted-foreground">metadata</span> : <Mark on={false} />}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}

function Mark({ on }: { on: boolean }) {
  return on ? <Check className="mx-auto size-4 text-ok" aria-label="Has access" /> : <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label="No access" />
}
