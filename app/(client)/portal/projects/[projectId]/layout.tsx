import { clientProject } from "@/lib/page-ctx"
import { decisions, needsYou, orgById, projectsFor } from "@/lib/data"
import { canSubmitChange } from "@/lib/access/audience"
import { LifecycleBadge } from "@/components/shared/badges"
import { clientSections } from "@/components/client/views"
import { RequestChangeButton } from "@/components/client/client-controls"
import { LifecycleNotice } from "@/components/shared/lifecycle-notice"
import { ProjectNav, type ProjectNavItem, SectionHeading } from "@/components/shared/project-nav"
import { ClientBreadcrumb } from "@/components/client/project-switcher"

export default async function ClientProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await clientProject(projectId)
  const sec = clientSections(ctx)
  const decs = decisions(ctx).filter((d) => d.state === "active").map((d) => ({ id: d.id, statement: d.statement }))
  const exec = ctx.user.kind === "exec"
  const projects = projectsFor(ctx.user).map((p) => ({ id: p.id, name: p.name, code: p.code, href: `/portal/projects/${p.id}` }))
  const needs = needsYou(ctx.user, projectId).length
  const base = `/portal/projects/${projectId}`
  const nav: ProjectNavItem[] = [
    { href: base, label: "Overview", intro: "Where the project stands and anything that needs you.", icon: "overview", exact: true, count: needs },
    ...(sec.journey ? [{ href: `${base}/journey`, label: "Timeline", intro: "Each phase and milestone, with its dates and who is responsible.", icon: "timeline" as const }] : []),
    ...(sec.documents ? [{ href: `${base}/documents`, label: "Documents", intro: "Reports, meeting notes and files Morphoverse has shared with you.", icon: "files" as const }] : []),
    ...(sec.decisions ? [{ href: `${base}/decisions`, label: "Decisions & agreements", intro: "Estimates, change requests and decisions made together.", icon: "approvals" as const }] : []),
  ]
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
      <LifecycleNotice project={ctx.project} client />
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        <ProjectNav items={nav} />
        <div className="min-w-0 pt-6 lg:pt-0">
          <SectionHeading items={nav} />
          {children}
        </div>
      </div>
    </div>
  )
}
