import { Ban } from "lucide-react"
import { staffProject } from "@/lib/page-ctx"
import { actions, blockers, changeRequests, ctxFor, members, milestones, phases, userName, workstreams, wsName } from "@/lib/data"
import { audienceLabel, canPublish, canSeeAudience, isProjectDirector } from "@/lib/access/audience"
import { fmtDate, phaseStatus, todayIso } from "@/lib/domain/rules"
import type { Audience } from "@/lib/domain/types"
import { AudienceBadge, MilestoneStateBadge, Pill } from "@/components/shared/badges"
import { MilestoneDates } from "@/components/shared/milestone-dates"
import { Empty, Section } from "@/components/shared/ui"
import { ActionStateButtons, AddActionDialog, AddBlockerDialog, MilestoneActions, ResolveBlocker } from "@/components/staff/plan-controls"

export default async function Plan({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await staffProject(projectId)
  const ms = milestones(ctx)
  const bl = blockers(ctx)
  const openBl = bl.filter((b) => !b.resolvedAt)
  const acts = actions(ctx)
  const people = members(projectId)
  const crs = changeRequests(ctx).filter((c) => ["approved", "awaiting_client_approval", "impact_review"].includes(c.state))
  const audiences: { label: string; value: Audience }[] = [
    { label: "Team (Morphoverse only)", value: { kind: "team" } },
    ...workstreams(projectId).map((w) => ({ label: `Workstream · ${w.name}`, value: { kind: "workstream", workstreamId: w.id } as Audience })),
    { label: "Client-wide", value: { kind: "client" } },
  ]

  return (
    <div className="space-y-5">
      <Section title="Phases & milestones" eyebrow="Baseline vs current — reasons on hover or tap">
        <div className="space-y-6">
          {phases(projectId).map((ph) => {
            const pm = ms.filter((m) => m.phaseId === ph.id)
            const status = phaseStatus(ph, ms)
            return (
              <div key={ph.id}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{String(ph.order).padStart(2, "0")}</span>
                  <h3 className="text-sm font-semibold">{ph.name}</h3>
                  <Pill tone={status === "Complete" ? "ok" : status === "In progress" ? "info" : "muted"}>{status}</Pill>
                </div>
                {pm.length === 0 ? (
                  <p className="pl-7 text-xs text-muted-foreground">No milestones in this phase.</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {pm.map((m) => {
                      const blocked = openBl.filter((b) => b.milestoneIds.includes(m.id))
                      const overdue = m.state !== "accepted" && m.currentDate < todayIso() && ctx.project.lifecycle !== "paused"
                      const approvers = people
                        .filter((p) => p.membership.role === "client_lead" || p.membership.role === "client_stakeholder")
                        .filter((p) => canSeeAudience(ctxFor(p.user, projectId)!, m.audience, m.authorId))
                        .map((p) => ({ id: p.user.id, label: `${p.user.name} · ${p.membership.role === "client_lead" ? "Client Lead" : "Stakeholder"}` }))
                      return (
                        <li key={m.id} className="grid gap-3 p-3 md:grid-cols-[1fr_auto_auto] md:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium">{m.name}</span>
                              <MilestoneStateBadge state={m.state} />
                              {blocked.length > 0 && <Pill tone="bad"><Ban className="size-3" /> Blocked</Pill>}
                              {overdue && <Pill tone="bad">Overdue</Pill>}
                              {ctx.project.lifecycle === "paused" && m.state !== "accepted" && <Pill tone="warn">Paused</Pill>}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <AudienceBadge kind={m.audience.kind} label={audienceLabel(m.audience, wsName)} />
                              <span>{m.acceptance === "client" ? "Client acceptance" : "Internal acceptance"}</span>
                              <span>· Owner {userName(m.ownerId)}</span>
                              {m.counterpartId && <span>· Client counterpart {userName(m.counterpartId)}</span>}
                            </div>
                          </div>
                          <MilestoneDates baseline={m.baselineDate} current={m.currentDate} changes={m.dateChanges} />
                          <MilestoneActions
                            projectId={projectId}
                            m={{ id: m.id, name: m.name, state: m.state, acceptance: m.acceptance, currentDate: m.currentDate, baselineDate: m.baselineDate, criteria: m.criteria }}
                            canPublish={canPublish(ctx)}
                            isDirector={isProjectDirector(ctx)}
                            approvers={approvers}
                            blockers={openBl.map((b) => ({ id: b.id, label: b.reason }))}
                            changes={crs.map((c) => ({ id: c.id, label: `CR-${c.number} ${c.what}` }))}
                          />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section
          title={`Blockers (${openBl.length} open)`}
          action={<AddBlockerDialog projectId={projectId} milestones={ms.filter((m) => m.state !== "accepted").map((m) => ({ id: m.id, label: m.name, date: m.currentDate }))} people={people.map((p) => ({ id: p.user.id, label: p.user.name }))} />}
        >
          {bl.length === 0 ? (
            <Empty title="No blockers" hint="Raise one when progress depends on someone else." />
          ) : (
            <ul className="space-y-2">
              {bl.map((b) => (
                <li key={b.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{b.reason}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {b.type} · {userName(b.responsibleId)} · raised {fmtDate(b.raisedAt)} · expected {fmtDate(b.expectedResolution)}
                      </p>
                      <p className="mt-1 text-xs">Affects: {b.milestoneIds.map((id) => ms.find((m) => m.id === id)?.name).filter(Boolean).join(", ") || "—"}</p>
                    </div>
                    {b.resolvedAt ? <Pill tone="ok">Resolved</Pill> : <ResolveBlocker projectId={projectId} id={b.id} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Actions" action={<AddActionDialog projectId={projectId} people={people.map((p) => ({ id: p.user.id, label: p.user.name }))} audiences={audiences} />}>
          {acts.length === 0 ? (
            <Empty title="No actions" hint="Actions from meeting records land here automatically." />
          ) : (
            <ul className="divide-y">
              {acts.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className={a.state !== "open" ? "text-sm text-muted-foreground line-through" : "text-sm"}>{a.description}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {userName(a.ownerId)}
                      {a.due && <span>· due {fmtDate(a.due)}</span>}
                      {a.source && <span>· from {a.source.label}</span>}
                      <AudienceBadge kind={a.audience.kind} label={audienceLabel(a.audience, wsName)} />
                    </p>
                  </div>
                  <ActionStateButtons projectId={projectId} id={a.id} state={a.state} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}
