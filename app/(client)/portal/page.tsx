import { ctxFor, needsYou, projectsFor, summary } from "@/lib/data"
import { requireUser } from "@/lib/page-ctx"
import { ProjectCard } from "@/components/shared/project-card"
import { NeedsList } from "@/components/shared/needs-list"
import { Empty, PageTitle } from "@/components/shared/ui"

export default async function ClientHome() {
  const user = await requireUser(["exec", "client_lead", "client_stakeholder"])
  const projects = projectsFor(user)
  const needs = needsYou(user)
  return (
    <>
      <PageTitle eyebrow="Your engagements with Morphoverse" title={<>Hello, <em>{user.name.split(" ")[0]}</em>.</>}>
        {needs.length ? `${needs.length} item${needs.length > 1 ? "s" : ""} need${needs.length === 1 ? "s" : ""} you.` : "Nothing needs you right now."}
      </PageTitle>
      {needs.length > 0 && (
        <section className="mb-8" aria-labelledby="needs-h">
          <h2 id="needs-h" className="mb-3 text-sm font-semibold">Needs you</h2>
          <NeedsList items={needs} showProject />
        </section>
      )}
      <h2 className="mb-3 text-sm font-semibold">Projects</h2>
      {projects.length === 0 ? (
        <Empty title="No projects to show yet" hint="You'll see a project here as soon as Morphoverse shares it with you." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <ProjectCard key={p.id} s={summary(ctxFor(user, p.id)!)} href={`/portal/projects/${p.id}`} needs={needs.filter((n) => n.projectId === p.id).length} />
          ))}
        </div>
      )}
    </>
  )
}
