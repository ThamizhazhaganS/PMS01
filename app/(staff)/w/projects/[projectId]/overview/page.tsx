import Link from "next/link"
import { AlertTriangle, CircleAlert, Clock, FileText, Flag, Hourglass, NotebookPen, Stamp } from "lucide-react"
import { staffProject } from "@/lib/page-ctx"
import { approvals, approvalView, blockers, members, milestones, needsYou, pickerData, recentComments, statuses, summary, timeView, userName } from "@/lib/data"
import { canPublish, isProjectDirector } from "@/lib/access/audience"
import { ROLE_LABEL, daysBetween, fmtDate, fmtDateTime, relDays, todayIso } from "@/lib/domain/rules"
import { HealthBadge, Pill } from "@/components/shared/badges"
import { Initials } from "@/components/shared/ui"
import { buttonVariants } from "@/components/ui/button"
import { StatusDialog } from "@/components/staff/status-dialog"
import { ClosurePanel } from "@/components/staff/closure-panel"
import { HoursByPerson, HoursList, LogHoursDialog } from "@/components/staff/hours-log"
import { UploadDialog } from "@/components/staff/publication-controls"
import { RecentComments } from "@/components/shared/recent-comments"
import { cn } from "@/lib/utils"

type Tone = "bad" | "warn" | "info"
interface Attention {
  key: string
  tone: Tone
  title: string
  detail: string
  href: string
  cta: string
}

const ICON = { bad: CircleAlert, warn: AlertTriangle, info: Clock }
const TONE = { bad: "text-bad", warn: "text-warn", info: "text-info" }

/** One headline number. */
function Headline({ icon: Icon, label, value, sub, pct, tone }: { icon: typeof Clock; label: string; value: React.ReactNode; sub?: React.ReactNode; pct?: number; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-brand" aria-hidden /> {label}
      </div>
      <div className={cn("mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums", tone === "bad" && "text-bad", tone === "warn" && "text-warn")}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</div>}
      {pct !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", tone === "bad" ? "bg-bad" : tone === "warn" ? "bg-warn" : "bg-ok")} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
    </div>
  )
}

export default async function Overview({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await staffProject(projectId)
  const base = `/w/projects/${projectId}`
  const s = summary(ctx)
  const st = s.status
  const history = statuses(ctx).slice(1, 4)
  const pending = approvals(ctx).filter((a) => a.state === "pending")
  const time = timeView(ctx)
  const canLog = time.canLog && !["closed", "cancelled", "archived"].includes(ctx.project.lifecycle)
  const people = members(projectId).filter((m) => m.user.status === "active")
  const keyPeople = people.filter((m) => m.user.id === ctx.project.ownerId || m.membership.role === "client_lead")
  const today = todayIso()

  // Everything that needs someone's attention, in one list, worst first.
  const attention: Attention[] = [
    ...milestones(ctx)
      .filter((m) => m.state !== "accepted" && m.state !== "dropped" && m.currentDate < today)
      .map((m) => ({ key: m.id, tone: "bad" as const, title: m.name, detail: `Milestone overdue · was due ${fmtDate(m.currentDate)}`, href: `${base}/plan`, cta: "Open" })),
    ...pending.map((a) => {
      const v = approvalView(ctx, a)
      return { key: a.id, tone: v.overdue ? ("bad" as const) : ("warn" as const), title: a.title, detail: `${v.approverNames.join(", ")} to decide · ${v.overdue ? "overdue" : `due ${fmtDate(a.due)}`}`, href: `${base}/decisions`, cta: "Open" }
    }),
    ...blockers(ctx)
      .filter((b) => !b.resolvedAt)
      .map((b) => ({ key: b.id, tone: "warn" as const, title: b.reason, detail: `Blocker · ${userName(b.responsibleId)} · open ${daysBetween(b.raisedAt, today)} days`, href: `${base}/plan`, cta: "Open" })),
    ...needsYou(ctx.user, projectId).map((n) => ({ key: n.id, tone: n.overdue ? ("bad" as const) : ("info" as const), title: n.title, detail: `For you · ${n.detail}`, href: n.href, cta: n.cta })),
  ].sort((a, b) => ["bad", "warn", "info"].indexOf(a.tone) - ["bad", "warn", "info"].indexOf(b.tone))

  const timeTone = time.usedPct === undefined ? undefined : time.usedPct > 100 ? "bad" : time.usedPct >= 85 ? "warn" : "ok"
  const overdueApprovals = pending.filter((a) => approvalView(ctx, a).overdue).length

  return (
    <div className="space-y-5">
      <ClosurePanel ctx={ctx} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Headline
          icon={Hourglass}
          label="Time used"
          value={time.usedPct !== undefined ? `${time.usedPct}%` : `${Math.round(time.loggedHours)} h`}
          sub={time.agreedHours !== undefined ? `${Math.round(time.loggedHours / 8)} of ${time.agreedDays} agreed days` : "No approved estimate yet"}
          pct={time.usedPct}
          tone={timeTone}
        />
        <Headline icon={Flag} label="Milestones" value={`${s.progress.accepted} of ${s.progress.total}`} sub="accepted" pct={s.progress.total ? (s.progress.accepted / s.progress.total) * 100 : 0} />
        <Headline icon={Clock} label="Next milestone" value={<span className="text-base">{s.next?.name ?? "—"}</span>} sub={s.next ? `${fmtDate(s.next.currentDate)} · ${relDays(s.next.currentDate)}` : undefined} />
        <Headline icon={Stamp} label="Waiting on client" value={pending.length} sub={overdueApprovals ? `${overdueApprovals} overdue` : "None overdue"} tone={overdueApprovals ? "bad" : undefined} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border bg-card p-5" aria-labelledby="attention-h">
            <h3 id="attention-h" className="text-base font-semibold">Needs attention</h3>
            {attention.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nothing is overdue, blocked or waiting. Good place to be.</p>
            ) : (
              <ul className="mt-2 divide-y">
                {attention.map((a) => {
                  const Icon = ICON[a.tone]
                  return (
                    <li key={a.key} className="flex items-center gap-3 py-3">
                      <Icon className={cn("size-4 shrink-0", TONE[a.tone])} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
                      </div>
                      <Link href={a.href} className={buttonVariants({ size: "sm", variant: "outline" })}>{a.cta}</Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-5" aria-labelledby="status-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 id="status-h" className="text-base font-semibold">Status</h3>
                <HealthBadge health={st?.health} />
                {/* System indicators sit beside health; health itself is always human-set (REQ-OVW-04). */}
                {s.stale && <Pill tone="warn">Older than 14 days</Pill>}
              </div>
              {isProjectDirector(ctx) && <StatusDialog projectId={projectId} current={st} />}
            </div>
            {st ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground">By {userName(st.authorId)} · {fmtDate(st.at)}</p>
                <p className="mt-3 text-base leading-relaxed">{st.text}</p>
                {st.explanation && <p className="mt-3 border-l-2 border-warn pl-3 text-sm text-muted-foreground">{st.explanation}</p>}
                {st.nextSteps && (
                  <p className="mt-3 text-sm">
                    <span className="font-medium">Next: </span>
                    <span className="text-muted-foreground">{st.nextSteps}</span>
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Write the first status so the client sees where the project stands.</p>
            )}
            {history.length > 0 && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Earlier statements</summary>
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
          </section>

          <RecentComments items={recentComments(ctx)} href={`${base}/publications`} />

          {time.canLog && (
            <details className="group rounded-2xl border bg-card p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                <span className="text-base font-semibold">{time.seesAll ? "Hours logged by the team" : "My hours"}</span>
                <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
                <span className="hidden text-xs text-muted-foreground group-open:inline">Hide</span>
              </summary>
              <div className="mt-4">
                <HoursByPerson rows={time.byPerson} />
                <HoursList projectId={projectId} entries={time.entries} seesAll={time.seesAll} viewerId={ctx.user.id} minDate={ctx.project.plannedStart} editable={canLog} />
              </div>
            </details>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border bg-card p-4" aria-labelledby="people-h">
            <h3 id="people-h" className="text-sm font-semibold">People</h3>
            <ul className="mt-3 grid gap-2.5">
              {keyPeople.map((m) => (
                <li key={m.user.id} className="flex items-center gap-2 text-sm">
                  <Initials name={m.user.name} className="size-7 text-[10px]" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{m.user.name}</span>
                    <span className="block text-xs text-muted-foreground">{m.user.id === ctx.project.ownerId ? "Owner" : m.membership.role === "client_lead" ? "Client lead" : ROLE_LABEL[m.user.kind]}</span>
                  </span>
                </li>
              ))}
            </ul>
            <Link href={`${base}/people`} className="mt-3 inline-block text-xs text-brand hover:underline">
              {people.length > keyPeople.length ? `+${people.length - keyPeople.length} more people` : "Team and access"}
            </Link>
          </section>

          {canLog && (
            <section className="rounded-2xl border bg-card p-4" aria-labelledby="quick-h">
              <h3 id="quick-h" className="text-sm font-semibold">Quick actions</h3>
              <div className="mt-3 grid gap-2 [&>*]:w-full [&>*]:justify-start">
                <LogHoursDialog projectId={projectId} minDate={ctx.project.plannedStart} />
                <UploadDialog projectId={projectId} data={pickerData(ctx)} canPublish={canPublish(ctx)} />
                <Link href={`${base}/publications/new`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                  <NotebookPen /> Meeting record
                </Link>
              </div>
            </section>
          )}

          {s.latest && (
            <Link href={`${base}/publications`} className="block rounded-2xl border bg-card p-4 transition hover:bg-muted/50">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="size-3.5" aria-hidden /> Latest shared · {fmtDateTime(s.latest.publishedAt)}
              </div>
              <p className="mt-1.5 text-sm font-medium">{s.latest.title}</p>
            </Link>
          )}
        </aside>
      </div>
    </div>
  )
}
