import { clientProject } from "@/lib/page-ctx"
import { decisions, needsYou, orgById, projectsFor } from "@/lib/data"
import { canSubmitChange } from "@/lib/access/audience"
import { LifecycleBadge } from "@/components/shared/badges"
import { clientSections } from "@/components/client/views"
import { RequestChangeButton } from "@/components/client/client-controls"
import { ClientTabs } from "@/components/client/client-tabs"
import { ClientBreadcrumb } from "@/components/client/project-switcher"

export default async function ClientProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await clientProject(projectId)
  const sec = clientSections(ctx)
  const decs = decisions(ctx).filter((d) => d.state === "active").map((d) => ({ id: d.id, statement: d.statement }))
  const exec = ctx.user.kind === "exec"
  const projects = projectsFor(ctx.user).map((p) => ({ id: p.id, name: p.name, code: p.code, href: `/portal/projects/${p.id}` }))
  const needs = needsYou(ctx.user, projectId).length
  return (
    <div>
      <ClientBreadcrumb home={exec ? { href: "/exec", label: "Portfolio" } : { href: "/portal", label: "Home" }} projects={projects} currentId={projectId} />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow">{orgById(ctx.project.clientOrgId)?.name} × Morphoverse</div>
          <h1 className="display mt-1.5 text-3xl leading-tight sm:text-4xl">{ctx.project.name}</h1>
          {ctx.project.lifecycle !== "active" && <div className="mt-2"><LifecycleBadge lifecycle={ctx.project.lifecycle} /></div>}
        </div>
        {canSubmitChange(ctx) && ctx.project.lifecycle !== "proposal" && <RequestChangeButton projectId={projectId} decisions={decs} />}
      </div>
      <ClientTabs projectId={projectId} sections={sec} needs={needs} />
      <div className="pt-6">{children}</div>
    </div>
  )
}
