import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { staffProject } from "@/lib/page-ctx"
import { approvals, orgById, statuses, userName } from "@/lib/data"
import { isOwner, isProjectDirector } from "@/lib/access/audience"
import { HealthBadge, LifecycleBadge } from "@/components/shared/badges"
import { LifecycleNotice } from "@/components/shared/lifecycle-notice"
import { ProjectNav, type ProjectNavItem, SectionHeading } from "@/components/shared/project-nav"
import { LifecycleControls } from "@/components/staff/lifecycle-controls"

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await staffProject(projectId)
  const p = ctx.project
  const st = statuses(ctx)[0]
  const base = `/w/projects/${p.id}`
  const pending = approvals(ctx).filter((a) => a.state === "pending").length
  const nav: ProjectNavItem[] = [
    { href: `${base}/overview`, label: "Overview", intro: "Where the project stands, what is next and who is involved.", icon: "overview" },
    { href: `${base}/plan`, label: "Plan", intro: "Phases, milestones, blockers and actions, with their dates.", icon: "plan" },
    { href: `${base}/commercial`, label: "Commercial", intro: "Estimates and their versions. Internal costs never reach the client.", icon: "commercial" },
    { href: `${base}/publications`, label: "Updates & files", intro: "Meeting notes and files. Everything starts private until you share it.", icon: "files" },
    { href: `${base}/decisions`, label: "Approvals & decisions", intro: "What is waiting for the client, what was agreed and change requests.", icon: "approvals", count: pending },
    { href: `${base}/people`, label: "Team & access", intro: "Who is on the project and what each person can see.", icon: "team" },
    { href: `${base}/history`, label: "Change history", intro: "Every change made on this project, with who made it and when.", icon: "history", secondary: true },
  ]
  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {ctx.user.kind === "director" ? (
          <>
            <Link href="/w" className="hover:text-foreground">Dashboard</Link>
            <ChevronRight className="size-3.5" aria-hidden />
            <Link href={`/w/orgs/${p.clientOrgId}`} className="hover:text-foreground">{orgById(p.clientOrgId)?.name}</Link>
          </>
        ) : (
          <Link href="/w/projects" className="hover:text-foreground">Projects</Link>
        )}
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-foreground">{p.code}</span>
      </nav>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow">
            {p.code} · {orgById(p.clientOrgId)?.name} · Owner {userName(p.ownerId)}
          </div>
          <h1 className="display mt-1.5 text-3xl leading-tight sm:text-4xl">{p.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <LifecycleBadge lifecycle={p.lifecycle} />
            <HealthBadge health={st?.health} />
            <span className="text-xs text-muted-foreground">
              Your role: {ctx.membership?.role === "owner" ? "Owner" : ctx.membership?.role === "team" ? "Team member" : ctx.membership?.role.replace("_", " ")}
              {ctx.membership?.role === "team" && (ctx.membership.publishRight ? " · can share with the client" : " · cannot share with the client")}
            </span>
          </div>
        </div>
        <LifecycleControls
          projectId={p.id}
          lifecycle={p.lifecycle}
          isOwner={isOwner(ctx)}
          isDirector={isProjectDirector(ctx)}
          cancelRequestedBy={p.cancelRequest?.by}
          viewerId={ctx.user.id}
        />
      </div>
      <LifecycleNotice project={p} />
      {["closed", "archived"].includes(p.lifecycle) && (
        <div className="mb-4 rounded-lg border bg-muted p-3 text-sm">
          <b>Read-only.</b> This project is {p.lifecycle}. Records are retained and cannot be changed; the CEO can reopen it with a reason.
        </div>
      )}
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
