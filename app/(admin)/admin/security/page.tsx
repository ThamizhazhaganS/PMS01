import { db } from "@/lib/store"
import { requireUser } from "@/lib/page-ctx"
import { userName } from "@/lib/data"
import { fmtDateTime } from "@/lib/domain/rules"
import { PageTitle, Section } from "@/components/shared/ui"

export default async function Security() {
  await requireUser(["admin"])
  const d = db()
  const events = d.audit.filter((a) => a.security).sort((a, b) => b.at.localeCompare(a.at))
  return (
    <>
      <PageTitle eyebrow="Append-only" title="Security log">Invitations, deactivations, access grants and revocations, self-grants, View As sessions and failed sign-ins.</PageTitle>
      <Section>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 font-medium">When (IST)</th><th className="py-2 font-medium">Event</th><th className="py-2 font-medium">Actor</th><th className="py-2 font-medium">Project</th><th className="py-2 font-medium">Detail</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b align-top last:border-0">
                  <td className="py-2 pr-3 text-xs whitespace-nowrap tabular-nums">{fmtDateTime(e.at)}</td>
                  <td className="py-2 pr-3 font-medium">{e.action}</td>
                  <td className="py-2 pr-3 text-xs">{userName(e.actorId)}</td>
                  <td className="py-2 pr-3 text-xs">{d.projects.find((p) => p.id === e.projectId)?.code ?? "Platform"}</td>
                  <td className="py-2 text-xs text-muted-foreground">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}
