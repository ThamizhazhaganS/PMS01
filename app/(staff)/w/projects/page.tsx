import Link from "next/link"
import { Plus } from "lucide-react"
import { needsYou } from "@/lib/data"
import { portfolioByOrg } from "@/lib/portfolio"
import { requireUser } from "@/lib/page-ctx"
import { ProjectCard } from "@/components/shared/project-card"
import { Empty, PageTitle } from "@/components/shared/ui"
import { buttonVariants } from "@/components/ui/button"

/** Every project the viewer is a member of, grouped by client organisation. */
export default async function AllProjects() {
  const user = await requireUser(["director", "team"])
  const { orgs } = portfolioByOrg(user)
  const needs = needsYou(user)
  return (
    <>
      <PageTitle
        eyebrow="Morphoverse · Engagements"
        title="All projects"
        action={user.kind === "director" && <Link href="/w/new" className={buttonVariants()}><Plus /> New project</Link>}
      >
        Only the engagements you are a member of.
      </PageTitle>
      {orgs.length === 0 && <Empty title="No engagements yet" hint="The CEO adds you to a project when you join its team." />}
      <div className="space-y-8">
        {orgs.map(({ org, rows }) => (
          <section key={org.id} aria-labelledby={`org-${org.id}`}>
            <h2 id={`org-${org.id}`} className="mb-3 flex items-baseline gap-2 text-sm font-semibold">
              {user.kind === "director" ? <Link href={`/w/orgs/${org.id}`} className="hover:underline">{org.name}</Link> : org.name}
              <span className="text-xs font-normal text-muted-foreground">{rows.length} project{rows.length === 1 ? "" : "s"}</span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((s) => (
                <ProjectCard key={s.project.id} s={s} href={`/w/projects/${s.project.id}/overview`} needs={needs.filter((n) => n.projectId === s.project.id).length} showMoney />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
