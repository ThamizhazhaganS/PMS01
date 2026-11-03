import { CirclePause, OctagonAlert } from "lucide-react"
import { staffProject } from "@/lib/page-ctx"
import { orgById, statuses, userName } from "@/lib/data"
import { isOwner, isProjectDirector } from "@/lib/access/audience"
import { fmtDate, relDays } from "@/lib/domain/rules"
import { HealthBadge, LifecycleBadge } from "@/components/shared/badges"
import { ProjectTabs } from "@/components/staff/project-tabs"
import { LifecycleControls } from "@/components/staff/lifecycle-controls"

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await staffProject(projectId)
  const p = ctx.project
  const st = statuses(ctx)[0]
  return (
    <div>
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
              Your role: {ctx.membership?.role.replace("_", " ")}
              {ctx.membership?.role === "team" && (ctx.membership.publishRight ? " · can publish" : " · no publish right")}
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
      {p.lifecycle === "paused" && p.pause && (
        <div className="mb-4 flex gap-3 rounded-lg border border-warn/30 bg-warn-soft p-3 text-sm">
          <CirclePause className="mt-0.5 size-4 shrink-0 text-warn" />
          <div>
            <b>Paused</b> {relDays(p.pause.at)} by {userName(p.pause.by)}: {p.pause.reason}
            <div className="text-xs text-muted-foreground">Due dates are flagged paused and overdue alerts are suspended.</div>
          </div>
        </div>
      )}
      {p.cancelRequest && p.lifecycle !== "cancelled" && (
        <div className="mb-4 flex gap-3 rounded-lg border border-bad/30 bg-bad-soft p-3 text-sm">
          <OctagonAlert className="mt-0.5 size-4 shrink-0 text-bad" />
          <div>
            <b>Cancellation requested</b> by {userName(p.cancelRequest.by)} on {fmtDate(p.cancelRequest.at)}: {p.cancelRequest.reason}
            <div className="text-xs text-muted-foreground">Another Director must confirm.</div>
          </div>
        </div>
      )}
      <ProjectTabs projectId={p.id} />
      <div className="pt-6">{children}</div>
    </div>
  )
}
