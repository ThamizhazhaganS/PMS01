import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { needsYou } from "@/lib/data"
import { attentionFor } from "@/lib/attention"
import { portfolioByOrg } from "@/lib/portfolio"
import { requireUser } from "@/lib/page-ctx"
import { ProjectCard } from "@/components/shared/project-card"
import { PageTitle, Section } from "@/components/shared/ui"
import { AttentionList, KpiRow } from "@/components/staff/dashboard"

/** One client organisation: its numbers and the viewer's projects with it. */
export default async function OrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const user = await requireUser(["director"])
  // Only organisations where the viewer has a project; anything else looks like it doesn't exist.
  const entry = portfolioByOrg(user).orgs.find((o) => o.org.id === orgId)
  if (!entry) notFound()
  const { org, rows, totals } = entry
  const attention = attentionFor(user).filter((a) => a.clientOrgId === orgId)
  const needs = needsYou(user)

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/w" className="hover:text-foreground">Dashboard</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-foreground">{org.name}</span>
      </nav>
      <PageTitle eyebrow={`Client organisation · ${org.code}`} title={org.name}>
        {rows.length} project{rows.length === 1 ? "" : "s"} you are part of with {org.name}.
      </PageTitle>
      <div className="space-y-6">
        <KpiRow t={totals} showMoney />
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2" aria-labelledby="projects-h">
            <h2 id="projects-h" className="mb-3 text-sm font-semibold">Projects</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {rows.map((s) => (
                <ProjectCard key={s.project.id} s={s} href={`/w/projects/${s.project.id}/overview`} needs={needs.filter((n) => n.projectId === s.project.id).length} showMoney />
              ))}
            </div>
          </section>
          <Section title={`Needs attention (${attention.length})`}>
            <AttentionList items={attention} limit={10} />
          </Section>
        </div>
      </div>
    </>
  )
}
