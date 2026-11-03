import { staffProject } from "@/lib/page-ctx"
import { approvalView, approvals, changeRequests, decisions, milestones, userName, wsName } from "@/lib/data"
import { audienceLabel, canPublish, isOwner } from "@/lib/access/audience"
import { fmtDate, fmtDateTime, fmtINR } from "@/lib/domain/rules"
import { ApprovalStateBadge, AudienceBadge, ChangeStateBadge, Pill } from "@/components/shared/badges"
import { Empty, Section } from "@/components/shared/ui"
import { ApprovalAdminControls, ChangeControls } from "@/components/staff/change-controls"
import { cn } from "@/lib/utils"

export default async function Decisions({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ cr?: string }> }) {
  const { projectId } = await params
  const { cr: focus } = await searchParams
  const ctx = await staffProject(projectId)
  const decs = decisions(ctx)
  const aps = approvals(ctx)
  const crs = changeRequests(ctx)
  const ms = milestones(ctx).filter((m) => m.state !== "accepted").map((m) => ({ id: m.id, name: m.name, date: m.currentDate }))
  const owner = isOwner(ctx)

  return (
    <div className="space-y-5">
      <Section title="Change requests" eyebrow="Triage → impact review → approval → implemented">
        {crs.length === 0 ? (
          <Empty title="No change requests" hint="Clients and team use “Request a change” on any item." />
        ) : (
          <ul className="space-y-3">
            {crs.map((c) => (
              <li key={c.id} id={c.id} className={cn("rounded-lg border p-4", focus === c.id && "ring-2 ring-brand")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-xs text-muted-foreground">CR-{c.number}</span>
                      <ChangeStateBadge state={c.state} />
                      <Pill>{c.category}</Pill>
                      <AudienceBadge kind={c.audience.kind} label={audienceLabel(c.audience, wsName)} />
                    </div>
                    <h3 className="mt-1.5 font-semibold">{c.what}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Why: {c.why}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {userName(c.authorId)} · {fmtDateTime(c.submittedAt)} · timing: {c.timing || "—"}
                      {c.linkedDecisionId && ` · revisits “${decs.find((d) => d.id === c.linkedDecisionId)?.statement ?? "decision"}”`}
                    </p>
                  </div>
                  {owner && <ChangeControls projectId={projectId} cr={{ id: c.id, number: c.number, state: c.state, impact: c.impact }} milestones={ms} />}
                </div>
                {c.clarification && (
                  <p className="mt-3 rounded-md bg-muted p-2 text-xs">Q: {c.clarification.question}{c.clarification.answer && <><br />A: {c.clarification.answer}</>}</p>
                )}
                {c.impact && (
                  <dl className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 text-xs sm:grid-cols-4">
                    <div><dt className="eyebrow">Dates</dt><dd className="mt-0.5">{c.impact.dateShiftDays ? `${c.impact.dateShiftDays > 0 ? "+" : ""}${c.impact.dateShiftDays}d on ${c.impact.milestoneIds.length}` : "None"}</dd></div>
                    <div><dt className="eyebrow">Effort</dt><dd className="mt-0.5">{c.impact.effortDays} person-days</dd></div>
                    <div><dt className="eyebrow">Cost</dt><dd className="mt-0.5">{c.impact.costDelta ? fmtINR(c.impact.costDelta) : "None"}</dd></div>
                    <div><dt className="eyebrow">Client approval</dt><dd className="mt-0.5">{c.impact.needsClientApproval ? "Required" : "Not required"}</dd></div>
                    <div className="col-span-full"><dt className="eyebrow">Scope</dt><dd className="mt-0.5">{c.impact.scope}</dd></div>
                  </dl>
                )}
                {c.declineReason && <p className="mt-2 text-xs text-bad">Declined: {c.declineReason}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Approval requests" eyebrow="Each bound to one exact version and named approvers">
        {aps.length === 0 ? (
          <Empty title="No approval requests" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 font-medium">Request</th><th className="py-2 font-medium">Approvers</th><th className="py-2 font-medium">Due</th><th className="py-2 font-medium">State</th><th className="py-2 font-medium">Record</th><th /></tr></thead>
              <tbody>
                {aps.map((a) => {
                  const v = approvalView(ctx, a)
                  return (
                    <tr key={a.id} className="border-b align-top last:border-0">
                      <td className="py-2.5 pr-3"><div className="font-medium">{a.title}</div><div className="text-xs text-muted-foreground">Tier {a.tier} · rule: {a.rule} · requested by {userName(a.requestedBy)}</div></td>
                      <td className="py-2.5 pr-3 text-xs">{v.approverNames.join(", ")}{v.unavailable.length > 0 && <div className="text-bad">Approver unavailable: {v.unavailable.join(", ")}</div>}</td>
                      <td className="py-2.5 pr-3 text-xs tabular-nums">{fmtDate(a.due)}{v.overdue && <div><Pill tone="bad">Overdue</Pill></div>}</td>
                      <td className="py-2.5 pr-3"><ApprovalStateBadge state={a.state} /></td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        {v.responses.map((r, i) => <div key={i}>{r.name}: {r.outcome}{r.comment && ` — “${r.comment}”`} · {fmtDateTime(r.at)} · {r.method}</div>)}
                        {v.withdrawnReason && <div>Withdrawn: {v.withdrawnReason}</div>}
                      </td>
                      <td className="py-2.5">{a.state === "pending" && canPublish(ctx) && <ApprovalAdminControls projectId={projectId} id={a.id} isOwner={owner} />}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Decision register">
        {decs.length === 0 ? (
          <Empty title="No decisions recorded" hint="Decisions from meeting records, approvals and change requests appear here." />
        ) : (
          <ul className="divide-y">
            {decs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", d.state === "superseded" && "text-muted-foreground line-through")}>{d.statement}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(d.date)} · {d.partyIds.map(userName).join(", ")}{d.context && ` · ${d.context}`}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <AudienceBadge kind={d.audience.kind} label={audienceLabel(d.audience, wsName)} />
                  <Pill tone={d.state === "active" ? "ok" : d.state === "under_revisit" ? "warn" : "muted"}>{d.state.replace("_", " ")}</Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
