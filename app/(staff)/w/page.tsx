import { ctxFor, needsYou, orgById, projectsFor, summary } from "@/lib/data"
import { requireUser } from "@/lib/page-ctx"
import { ProjectCard } from "@/components/shared/project-card"
import { Empty, PageTitle } from "@/components/shared/ui"

export default async function StaffHome() {
  const user = await requireUser(["director", "team"])
  const projects = projectsFor(user)
  const needs = needsYou(user)
  return (
    <>
      <PageTitle eyebrow="Morphoverse · Engagements" title={<>Good to see you, <em>{user.name.split(" ")[0]}</em>.</>}>
        You see only the engagements you are a member of. There is no firm-wide view.
      </PageTitle>
      {projects.length === 0 ? (
        <Empty title="No engagements yet" hint="A Director adds you to a project when you join its team." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              s={summary(ctxFor(user, p.id)!)}
              href={`/w/projects/${p.id}/overview`}
              needs={needs.filter((n) => n.projectId === p.id).length}
              orgName={orgById(p.clientOrgId)?.name}
              showMoney
            />
          ))}
        </div>
      )}
    </>
  )
}
