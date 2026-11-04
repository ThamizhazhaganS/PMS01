import Link from "next/link"
import { AlertTriangle, Clock, FileText } from "lucide-react"
import { staffProject } from "@/lib/page-ctx"
import { approvals, approvalView, members, milestones, needsYou, pickerData, statuses, summary, timeView, userName } from "@/lib/data"
import { canPublish, isProjectDirector } from "@/lib/access/audience"
import { ROLE_LABEL, fmtDate, fmtDateTime, fmtINR, isStaffKind, relDays, todayIso } from "@/lib/domain/rules"
import { ApprovalStateBadge, HealthBadge, Pill } from "@/components/shared/badges"
import { NeedsList } from "@/components/shared/needs-list"
import { Initials, Section, Stat } from "@/components/shared/ui"
import { StatusDialog } from "@/components/staff/status-dialog"
import { ClosurePanel } from "@/components/staff/closure-panel"
import { AtAGlance } from "@/components/shared/at-a-glance"
import { HoursByPerson, HoursList, LogHoursDialog } from "@/components/staff/hours-log"
import { UploadDialog } from "@/components/staff/publication-controls"

export default async function Overview({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await staffProject(projectId)
  const s = summary(ctx)
  const st = s.status
  const ms = milestones(ctx)
  const overdueMs = ms.filter((m) => m.state !== "accepted" && m.state !== "dropped" && m.currentDate < todayIso())
  const history = statuses(ctx).slice(1, 4)
  const pending = approvals(ctx).filter((a) => a.state === "pending")
  const time = timeView(ctx)
  const people = members(projectId).filter((m) => m.user.status === "active")
  const ourSide = people.filter((m) => isStaffKind(m.user.kind))
  const theirSide = people.filter((m) => !isStaffKind(m.user.kind))
  const canLog = time.canLog && !["closed", "cancelled", "archived"].includes(ctx.project.lifecycle)

  return (
    <div className="space-y-5">
    <ClosurePanel ctx={ctx} />
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Section
          eyebrow="Status statement"
          title={st ? `By ${userName(st.authorId)} · ${fmtDate(st.at)}` : "No statement yet"}
          action={isProjectDirector(ctx) && <StatusDialog projectId={projectId} current={st} />}
        >
          <div className="flex flex-wrap items-center gap-2">
            <HealthBadge health={st?.health} size="lg" />
            {/* System indicators sit beside health; health itself is always human-set (REQ-OVW-04). */}
            {s.stale && <Pill tone="warn"><Clock className="size-3" /> Stale — older than 14 days</Pill>}
            {overdueMs.length > 0 && <Pill tone="bad">{overdueMs.length} overdue milestone{overdueMs.length > 1 ? "s" : ""}</Pill>}
            {s.openBlockers.length > 0 && <Pill tone="warn"><AlertTriangle className="size-3" /> {s.openBlockers.length} open blocker{s.openBlockers.length > 1 ? "s" : ""}</Pill>}
            {s.overdueApprovals.length > 0 && <Pill tone="bad">{s.overdueApprovals.length} overdue approval{s.overdueApprovals.length > 1 ? "s" : ""}</Pill>}
          </div>
          {st ? (
            <>
              <p className="mt-4 text-lg leading-relaxed">{st.text}</p>
              {st.explanation && <p className="mt-3 border-l-2 border-warn pl-3 text-sm text-muted-foreground">{st.explanation}</p>}
              <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
                <div className="eyebrow mb-1">Morphoverse next steps</div>
                {st.nextSteps}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Write the first status statement so clients see where the project stands.</p>
          )}
          {history.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground">Earlier statements</summary>
              <ul className="mt-2 space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="flex gap-2 text-xs">
                    <HealthBadge health={h.health} />
                    <span className="text-muted-foreground">{fmtDate(h.at)} — {h.text}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Section>

        <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5 md:grid-cols-4">
          <Stat label="Progress" value={`${s.progress.accepted} of ${s.progress.total}`} sub="milestones accepted" />
          <Stat label="Expected completion" value={fmtDate(s.expectedEnd)} sub={`Target ${fmtDate(ctx.project.targetEnd)}`} />
          <Stat label="Next milestone" value={s.next?.name ?? "—"} sub={s.next ? `${fmtDate(s.next.currentDate)} · ${relDays(s.next.currentDate)}` : undefined} />
          <Stat label="Agreed cost" value={s.approvedTotal !== undefined ? fmtINR(s.approvedTotal) : "Not yet approved"} sub="from approved estimate" />
        </div>

        <AtAGlance t={time} action={canLog && <LogHoursDialog projectId={projectId} minDate={ctx.project.plannedStart} />} />

        <Section title="Awaiting client decisions" action={<Link className="text-xs text-brand hover:underline" href={`/w/projects/${projectId}/decisions`}>All approvals</Link>}>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending approval requests.</p>
          ) : (
            <ul className="divide-y">
              {pending.map((a) => {
                const v = approvalView(ctx, a)
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.tier === "A" ? "Needs a one-time code" : "One-click approval"} · {v.approverNames.join(", ")} · due {fmtDate(a.due)}
                        {v.unavailable.length > 0 && <span className="text-bad"> · approver unavailable: {v.unavailable.join(", ")}</span>}
                      </p>
                    </div>
                    {v.overdue ? <Pill tone="bad">Overdue</Pill> : <ApprovalStateBadge state={a.state} />}
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      </div>

      <div className="space-y-5">
        <Section title="Project team" action={<Link className="text-xs text-brand hover:underline" href={`/w/projects/${projectId}/people`}>Team & access</Link>}>
          {[{ label: "Morphoverse", list: ourSide }, { label: "Client", list: theirSide }].map((g) => (
            <div key={g.label} className="mb-3 last:mb-0">
              <h3 className="eyebrow mb-1.5">{g.label}</h3>
              {g.list.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one yet.</p>
              ) : (
                <ul className="grid gap-1.5">
                  {g.list.map((m) => (
                    <li key={m.user.id} className="flex items-center gap-2 text-sm">
                      <Initials name={m.user.name} className="size-6 text-[10px]" />
                      <span className="font-medium">{m.user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {m.user.id === ctx.project.ownerId ? "Owner" : m.membership.role === "client_lead" ? "Client lead" : ROLE_LABEL[m.user.kind]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Section>
        <Section title="Needs me">
          <NeedsList items={needsYou(ctx.user, projectId)} />
        </Section>
        {time.canLog && (
          <Section title={time.seesAll ? "Hours logged by the team" : "My hours"}>
            <HoursByPerson rows={time.byPerson} />
            <HoursList projectId={projectId} entries={time.entries} seesAll={time.seesAll} viewerId={ctx.user.id} minDate={ctx.project.plannedStart} editable={canLog} />
          </Section>
        )}
        <Section title="Latest update shared" action={canLog && <UploadDialog projectId={projectId} data={pickerData(ctx)} canPublish={canPublish(ctx)} />}>
          {s.latest ? (
            <Link href={`/w/projects/${projectId}/publications`} className="block rounded-lg p-1 hover:bg-muted">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="size-3.5" /> {s.latest.kind} · {fmtDateTime(s.latest.publishedAt)}
              </div>
              <p className="mt-1 font-medium">{s.latest.title}</p>
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{s.latest.summary}</p>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing shared yet. Use Updates & files → New meeting record.</p>
          )}
        </Section>
      </div>
    </div>
    </div>
  )
}
