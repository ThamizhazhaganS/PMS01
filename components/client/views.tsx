import Link from "next/link"
import { Ban, CalendarClock, Download, FileText, Lock, Paperclip } from "lucide-react"
import type { AccessCtx } from "@/lib/access/audience"
import {
  actions as visibleActions,
  approvalView,
  approvals,
  blockers,
  changeRequests,
  clientTotal,
  decisions,
  documents,
  estimates,
  milestones,
  needsYou,
  phases,
  publications,
  summary,
  threadViews,
  userName,
  visibleAttachments,
} from "@/lib/data"
import { fmtDate, fmtDateTime, phaseStatus, relDays, todayIso } from "@/lib/domain/rules"
import { ApprovalStateBadge, ChangeStateBadge, EstimateStateBadge, HealthBadge, MilestoneStateBadge, Pill, SharedWithYou } from "@/components/shared/badges"
import { MilestoneDates } from "@/components/shared/milestone-dates"
import { NeedsList } from "@/components/shared/needs-list"
import { EstimateBody } from "@/components/shared/estimate-view"
import { CommentThreads } from "@/components/shared/comment-thread"
import { RequestAccessButton, RequestCorrection, WithdrawChange } from "./client-controls"
import { cn } from "@/lib/utils"

/** Which client sections have content (UX-06: hide empty sections). */
export function clientSections(ctx: AccessCtx) {
  return {
    journey: milestones(ctx).length > 0,
    documents: publications(ctx).length > 0 || documents(ctx).length > 0,
    decisions: decisions(ctx).length > 0 || estimates(ctx).length > 0 || changeRequests(ctx).length > 0,
  }
}

export function ClientOverview({ ctx, readOnly, openApproval, base }: { ctx: AccessCtx; readOnly?: boolean; openApproval?: string; base: string }) {
  const s = summary(ctx)
  const needs = needsYou(ctx.user, ctx.project.id)
  const closure = ctx.project.closure
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {closure && (
        <section className="rounded-xl border border-brand/30 bg-brand-soft/50 p-4 lg:col-span-5" aria-label="Closure">
          <p className="font-medium">
            {closure.finalizedAt ? `This engagement closed on ${fmtDate(closure.finalizedAt)}.` : "This engagement is in its closing phase."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Closure checklist: {closure.items.filter((i) => i.state !== "pending").length} of {closure.items.length} complete
            {closure.finalizedAt ? " · records are kept read-only." : " · Morphoverse will ask for final acceptance once everything is in place."}
          </p>
        </section>
      )}
      <section className="rounded-2xl border bg-card p-5 sm:p-7 lg:col-span-3" aria-labelledby="status-h">
        <div className="eyebrow" id="status-h">Where the project stands</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <HealthBadge health={s.status?.health} size="lg" />
          {s.status && <span className="text-xs text-muted-foreground">Updated {relDays(s.status.at)} by {userName(s.status.authorId)}</span>}
        </div>
        {s.status ? (
          <>
            <p className="mt-4 text-xl leading-relaxed sm:text-2xl">{s.status.text}</p>
            {s.status.explanation && <p className="mt-3 border-l-2 border-warn pl-3 text-sm text-muted-foreground">{s.status.explanation}</p>}
          </>
        ) : (
          <p className="mt-4 text-muted-foreground">Morphoverse will post the first status update shortly.</p>
        )}
        <dl className="mt-6 grid grid-cols-2 gap-5 border-t pt-5 sm:grid-cols-3">
          <div>
            <dt className="eyebrow">Next milestone</dt>
            <dd className="mt-1 font-semibold">{s.next?.name ?? "—"}</dd>
            {s.next && <dd className="text-sm text-muted-foreground tabular-nums">{fmtDate(s.next.currentDate)}</dd>}
          </div>
          <div>
            <dt className="eyebrow">Progress</dt>
            <dd className="mt-1 font-semibold tabular-nums">{s.progress.accepted} of {s.progress.total}</dd>
            <dd className="text-sm text-muted-foreground">milestones accepted</dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="eyebrow">Expected completion</dt>
            <dd className="mt-1 font-semibold">{fmtDate(s.expectedEnd ?? ctx.project.targetEnd)}</dd>
          </div>
        </dl>
      </section>

      <div className="space-y-5 lg:col-span-2">
        <section aria-labelledby="needs-h">
          <h2 id="needs-h" className="mb-2 flex items-center gap-2 text-sm font-semibold">
            Needs you {needs.length > 0 && <span className="rounded-full bg-brand px-2 text-xs leading-5 text-brand-foreground">{needs.length}</span>}
          </h2>
          {readOnly ? (
            <ul className="divide-y rounded-lg border text-sm">{needs.length ? needs.map((n) => <li key={n.id} className="p-3">{n.title}<div className="text-xs text-muted-foreground">{n.detail}</div></li>) : <li className="p-3 text-muted-foreground">Nothing needs this user.</li>}</ul>
          ) : (
            <NeedsList items={needs} openId={openApproval} emptyText="Nothing needs you right now. We'll email you when it does." />
          )}
        </section>
        {s.status?.nextSteps && (
          <section className="rounded-xl border bg-card p-4">
            <h2 className="eyebrow mb-1.5">What Morphoverse is doing next</h2>
            <p className="text-sm">{s.status.nextSteps}</p>
          </section>
        )}
        {s.latest && (
          <Link href={`${base}/documents`} className="block rounded-xl border bg-card p-4 transition hover:border-foreground/20">
            <h2 className="eyebrow mb-1.5">Latest from Morphoverse</h2>
            <p className="font-medium">{s.latest.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.latest.summary}</p>
            <p className="mt-2 text-xs text-muted-foreground">{fmtDate(s.latest.publishedAt)}</p>
          </Link>
        )}
      </div>
    </div>
  )
}

export function ClientJourney({ ctx }: { ctx: AccessCtx }) {
  const ms = milestones(ctx)
  const bl = blockers(ctx).filter((b) => !b.resolvedAt)
  const paused = ctx.project.lifecycle === "paused"
  return (
    <ol className="space-y-6" aria-label="Project journey">
      {phases(ctx.project.id).map((ph) => {
        const pm = ms.filter((m) => m.phaseId === ph.id)
        if (pm.length === 0) return null
        const status = phaseStatus(ph, ms)
        return (
          <li key={ph.id}>
            <div className="mb-2 flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full", status === "Complete" ? "bg-ok" : status === "In progress" ? "bg-brand" : "bg-muted-foreground/30")} aria-hidden />
              <h3 className="text-sm font-semibold">{ph.name}</h3>
              <span className="text-xs text-muted-foreground">{status}</span>
            </div>
            <ul className="space-y-2 border-l pl-4 ml-1">
              {pm.map((m) => {
                const blocked = bl.filter((b) => b.milestoneIds.includes(m.id))
                return (
                  <li key={m.id} className="rounded-lg border bg-card p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{m.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <MilestoneStateBadge state={m.state} />
                          {blocked.length > 0 && <Pill tone="bad"><Ban className="size-3" /> Blocked</Pill>}
                          {paused && m.state !== "accepted" && <Pill tone="warn">Paused</Pill>}
                          {!paused && m.state !== "accepted" && m.currentDate < todayIso() && <Pill tone="bad">Overdue</Pill>}
                        </div>
                      </div>
                      <MilestoneDates baseline={m.baselineDate} current={m.currentDate} changes={m.dateChanges} />
                    </div>
                    {blocked.map((b) => (
                      <p key={b.id} className="mt-2 rounded-md bg-bad-soft/60 p-2 text-xs">Waiting on: {b.reason} · {userName(b.responsibleId)} · expected {fmtDate(b.expectedResolution)}</p>
                    ))}
                  </li>
                )
              })}
            </ul>
          </li>
        )
      })}
    </ol>
  )
}

export function ClientDocuments({ ctx, readOnly }: { ctx: AccessCtx; readOnly?: boolean }) {
  const pubs = publications(ctx).filter((p) => !p.supersededById)
  const docs = documents(ctx)
  const decs = decisions(ctx)
  const acts = visibleActions(ctx)
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <section className="lg:col-span-3" aria-labelledby="records-h">
        <h2 id="records-h" className="mb-3 text-sm font-semibold">Meeting records & updates</h2>
        {pubs.length === 0 && <p className="text-sm text-muted-foreground">Nothing has been shared with you yet.</p>}
        <ul className="space-y-3">
          {pubs.map((p) => (
            <li key={p.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Pill>{p.kind}</Pill>
                {p.version > 1 && <Pill tone="info">Revised · v{p.version}</Pill>}
                {p.meetingAt && <span className="inline-flex items-center gap-1"><CalendarClock className="size-3" /> {fmtDateTime(p.meetingAt)}</span>}
                {p.meetingAt && p.publishedAt && new Date(p.publishedAt).getTime() - new Date(p.meetingAt).getTime() > 2 * 864e5 && <span>· shared {fmtDate(p.publishedAt)}</span>}
              </div>
              <h3 className="mt-2 font-semibold">{p.title}</h3>
              {p.retracted ? (
                <p className="mt-2 rounded-md bg-muted p-2 text-sm text-muted-foreground">This record was withdrawn on {fmtDate(p.retracted.at)}.</p>
              ) : (
                <>
                  <p className="mt-2 text-sm">{p.summary}</p>
                  {p.changeNote && <p className="mt-1 text-xs text-muted-foreground">What changed: {p.changeNote}</p>}
                  {p.decisionIds.length > 0 && <div className="mt-3 text-sm"><div className="eyebrow mb-1">Decisions</div><ul className="list-inside list-disc">{p.decisionIds.map((id) => { const d = decs.find((x) => x.id === id); return d && <li key={id}>{d.statement}</li> })}</ul></div>}
                  {p.actionIds.length > 0 && <div className="mt-3 text-sm"><div className="eyebrow mb-1">Next steps</div><ul className="list-inside list-disc">{p.actionIds.map((id) => { const a = acts.find((x) => x.id === id); return a && <li key={id}>{a.description} — {userName(a.ownerId)}</li> })}</ul></div>}
                  {visibleAttachments(ctx, p).length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {visibleAttachments(ctx, p).map((a) => (
                        <li key={a.documentId}>
                          {a.doc.retracted ? <span className="text-xs text-muted-foreground">{a.doc.title} — withdrawn</span> : (
                            <a href={`/api/files/${a.documentId}?v=${a.version}`} className="inline-flex items-center gap-1.5 text-sm text-brand hover:underline"><Paperclip className="size-3.5" /> {a.doc.title} (v{a.version})</a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <SharedWithYou />
                    {p.kind === "meeting" && <RequestCorrection projectId={ctx.project.id} pubId={p.id} disabled={readOnly} />}
                  </div>
                  {!readOnly && <CommentThreads projectId={ctx.project.id} subject={{ kind: "publication", id: p.id }} threads={threadViews(ctx, p.id)} staff={false} />}
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="lg:col-span-2" aria-labelledby="docs-h">
        <h2 id="docs-h" className="mb-3 text-sm font-semibold">Documents</h2>
        <ul className="divide-y rounded-xl border bg-card">
          {docs.length === 0 && <li className="p-4 text-sm text-muted-foreground">No documents yet.</li>}
          {docs.map((d) => {
            if ("restricted" in d)
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="flex items-center gap-2 text-sm"><Lock className="size-4 text-muted-foreground" /><div><div className="font-medium">Restricted item</div><div className="text-xs text-muted-foreground">{d.kind} · shared {fmtDate(d.publishedAt)} · named recipients only</div></div></div>
                  <RequestAccessButton projectId={ctx.project.id} docId={d.id} disabled={readOnly} />
                </li>
              )
            const cur = d.versions.at(-1)!
            return (
              <li key={d.id} className="p-3">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="text-sm font-medium">{d.title}</span>{!d.retracted && <Pill tone="ok">Current · v{cur.n}</Pill>}</div>
                    {d.retracted ? (
                      <p className="mt-1 text-xs text-muted-foreground">Withdrawn on {fmtDate(d.retracted.at)}. No longer available.</p>
                    ) : (
                      <>
                        <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(cur.uploadedAt)} — {cur.changeNote}</p>
                        <a href={`/api/files/${d.id}?v=${cur.n}`} className="mt-1 inline-flex items-center gap-1 text-xs text-brand hover:underline"><Download className="size-3" /> Download v{cur.n}</a>
                        {d.versions.length > 1 && (
                          <details className="mt-1 text-xs text-muted-foreground"><summary className="cursor-pointer">Earlier versions</summary>
                            <ul className="mt-1 space-y-0.5">{d.versions.slice(0, -1).reverse().map((v) => <li key={v.n}><a className="hover:underline" href={`/api/files/${d.id}?v=${v.n}`}>v{v.n}</a> · {fmtDate(v.uploadedAt)} — {v.changeNote}</li>)}</ul>
                          </details>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

export function ClientDecisions({ ctx, readOnly }: { ctx: AccessCtx; readOnly?: boolean }) {
  const ests = estimates(ctx).filter((e) => ["approved", "shared"].includes(e.state))
  const decs = decisions(ctx)
  const crs = changeRequests(ctx)
  const aps = approvals(ctx).filter((a) => a.state !== "pending")
  return (
    <div className="space-y-6">
      {ests.map((e) => (
        <section key={e.id} className="rounded-xl border bg-card p-5" aria-label={`Estimate v${e.version}`}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{e.state === "approved" ? "Agreed estimate" : "Estimate awaiting your decision"} · v{e.version}</h2>
            <EstimateStateBadge state={e.state} />
            {e.approvedAt && <span className="text-xs text-muted-foreground">Approved {fmtDate(e.approvedAt)}</span>}
          </div>
          <EstimateBody e={e} total={clientTotal(e)} clientView />
          <p className="mt-4 text-xs text-muted-foreground">Record of agreement only; not a contract or payment authorization.</p>
        </section>
      ))}

      {crs.length > 0 && (
        <section aria-labelledby="cr-h">
          <h2 id="cr-h" className="mb-3 text-sm font-semibold">Change requests</h2>
          <ul className="space-y-2">
            {crs.map((c) => (
              <li key={c.id} className="rounded-lg border bg-card p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="font-mono text-xs text-muted-foreground">CR-{c.number}</span><ChangeStateBadge state={c.state} /></div>
                    <p className="mt-1 text-sm font-medium">{c.what}</p>
                    <p className="text-xs text-muted-foreground">Raised by {userName(c.authorId)} · {fmtDate(c.submittedAt)}</p>
                    {c.impact && c.state === "awaiting_client_approval" && <p className="mt-1 text-xs">Impact: {c.impact.scope}</p>}
                    {c.declineReason && <p className="mt-1 text-xs text-bad">Declined: {c.declineReason}</p>}
                  </div>
                  {!readOnly && c.authorId === ctx.user.id && !["approved", "implemented", "declined", "withdrawn"].includes(c.state) && <WithdrawChange projectId={ctx.project.id} id={c.id} />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="dec-h">
        <h2 id="dec-h" className="mb-3 text-sm font-semibold">What we&apos;ve agreed</h2>
        {decs.length === 0 ? <p className="text-sm text-muted-foreground">No decisions yet.</p> : (
          <ul className="divide-y rounded-xl border bg-card">
            {decs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", d.state === "superseded" && "text-muted-foreground line-through")}>{d.statement}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(d.date)} · {d.partyIds.map(userName).join(", ")}</p>
                </div>
                {d.state !== "active" && <Pill tone={d.state === "under_revisit" ? "warn" : "muted"}>{d.state === "under_revisit" ? "Under revisit" : "Superseded"}</Pill>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {aps.length > 0 && (
        <section aria-labelledby="ap-h">
          <h2 id="ap-h" className="mb-3 text-sm font-semibold">Approval record</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {aps.map((a) => {
              const v = approvalView(ctx, a)
              return (
                <li key={a.id} className="p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{a.title}</span><ApprovalStateBadge state={a.state} /></div>
                  {v.responses.map((r, i) => <p key={i} className="mt-1 text-xs text-muted-foreground">{r.name} · {r.outcome === "approve" ? "Approved" : r.outcome === "changes" ? "Requested changes" : "Declined"} · {fmtDateTime(r.at)} · {r.method}{r.comment && ` — “${r.comment}”`}</p>)}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
