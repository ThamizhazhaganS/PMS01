import { CheckCircle2, CircleDashed, Lock, MinusCircle } from "lucide-react"
import type { AccessCtx } from "@/lib/access/audience"
import { isOwner, isProjectDirector } from "@/lib/access/audience"
import { db } from "@/lib/store"
import { userName } from "@/lib/data"
import { SURVEY_QUESTIONS, fmtDateTime } from "@/lib/domain/rules"
import type { Closure } from "@/lib/domain/types"
import { ApprovalStateBadge, Pill } from "@/components/shared/badges"
import { Section } from "@/components/shared/ui"
import { ClosureItemControls, FinalAcceptanceButton, FinalizeButton } from "./closure-controls"

/** Closure checklist, final acceptance and client feedback (REQ-CLS-01…04). */
export function ClosurePanel({ ctx }: { ctx: AccessCtx }) {
  const c = ctx.project.closure
  const previous = ctx.project.previousClosures ?? []
  if (!c) return previous.length ? <p className="text-xs text-muted-foreground">{previous.length} earlier closure record(s) preserved from before reopening.</p> : null
  const open = !c.finalizedAt && ctx.project.lifecycle === "closing"
  const director = isProjectDirector(ctx)
  const final = db().approvals.find((a) => a.id === c.finalApprovalId)
  const pending = c.items.filter((i) => i.state === "pending").length
  const canClose = pending === 0 && final?.state === "approved"

  return (
    <Section
      eyebrow={c.finalizedAt ? `Finalised ${fmtDateTime(c.finalizedAt)} by ${userName(c.finalizedBy!)}` : `Started ${fmtDateTime(c.startedAt)} by ${userName(c.startedBy)}`}
      title={<span className="flex items-center gap-2">Closure record {c.finalizedAt && <Pill tone="ok"><Lock className="size-3" /> Locked</Pill>}</span>}
      action={
        open && isOwner(ctx) && (
          <>
            {(!final || ["declined", "changes_requested", "withdrawn"].includes(final.state)) && <FinalAcceptanceButton projectId={ctx.project.id} again={!!final} />}
            <FinalizeButton projectId={ctx.project.id} disabled={!canClose} />
          </>
        )
      }
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="eyebrow mb-2">Checklist · {c.items.length - pending} of {c.items.length} done</h3>
          <ul className="divide-y rounded-lg border">
            {c.items.map((i) => (
              <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="flex min-w-0 items-start gap-2">
                  {i.state === "met" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /> : i.state === "waived" ? <MinusCircle className="mt-0.5 size-4 shrink-0 text-warn" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0">
                    <p className="text-sm">{i.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.state === "pending" ? "Pending" : `${i.state === "met" ? "Met" : "Waived"} by ${userName(i.by!)}`}
                      {i.waiverReason && ` — “${i.waiverReason}”`}
                    </p>
                  </div>
                </div>
                {open && director && <ClosureItemControls projectId={ctx.project.id} itemKey={i.key} state={i.state} label={i.label} />}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="eyebrow mb-2">Final acceptance (needs a one-time code)</h3>
            {final ? (
              <div className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>{final.approverIds.map(userName).join(", ")}</span>
                  <ApprovalStateBadge state={final.state} />
                </div>
                {final.responses.map((r, n) => (
                  <p key={n} className="mt-1 text-xs text-muted-foreground">{userName(r.userId)} · {fmtDateTime(r.at)} · {r.method}{r.comment && ` — “${r.comment}”`}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not requested yet.</p>
            )}
          </div>
          <div>
            <h3 className="eyebrow mb-2">Client feedback</h3>
            <SurveySummary survey={c.survey} />
          </div>
        </div>
      </div>
      {open && !canClose && (
        <p className="mt-4 text-xs text-muted-foreground">
          The project can close only when no checklist item is Pending and the client has approved final acceptance.
        </p>
      )}
    </Section>
  )
}

function SurveySummary({ survey }: { survey: Closure["survey"] }) {
  if (!survey) return <p className="text-sm text-muted-foreground">Waiting for the Client Lead.</p>
  if ("skipped" in survey) return <p className="text-sm text-muted-foreground">Skipped by {userName(survey.by)} on {fmtDateTime(survey.at)}.</p>
  return (
    <div className="rounded-lg border p-3 text-sm">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        {SURVEY_QUESTIONS.map(([k, label]) => (
          <div key={k} className="contents">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-right text-xs font-medium tabular-nums">{survey[k]} / 5</dd>
          </div>
        ))}
      </dl>
      {survey.comments && <p className="mt-2 border-t pt-2 text-xs">“{survey.comments}”</p>}
      <p className="mt-1 text-[11px] text-muted-foreground">{userName(survey.by)} · {fmtDateTime(survey.at)}</p>
    </div>
  )
}
