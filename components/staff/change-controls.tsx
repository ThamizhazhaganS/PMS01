"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { advanceChange, recordExternalApproval, saveImpact, triageChange, withdrawApproval } from "@/lib/actions"
import type { ChangeState, ImpactReview } from "@/lib/domain/types"
import { fmtDate, fmtINR } from "@/lib/domain/rules"
import { ActionButton, ReasonDialog } from "@/components/shared/dialogs"
import { Field } from "@/components/shared/ui"
import { useAction } from "@/components/shared/use-action"

export function ChangeControls({ projectId, cr, milestones }: { projectId: string; cr: { id: string; number: number; state: ChangeState; impact?: ImpactReview }; milestones: { id: string; name: string; date: string }[] }) {
  const s = cr.state
  return (
    <div className="flex flex-wrap gap-1.5">
      {s === "submitted" && <ActionButton size="xs" variant="default" onRun={() => triageChange(projectId, cr.id, "acknowledge", "")}>Acknowledge</ActionButton>}
      {["submitted", "under_review"].includes(s) && (
        <ReasonDialog trigger="Ask for clarification" size="xs" title={`Clarify CR-${cr.number}`} label="Your question" minLength={5} confirm="Send question" onSubmit={(t) => triageChange(projectId, cr.id, "clarify", t)} />
      )}
      {["under_review", "impact_review"].includes(s) && <ImpactDialog projectId={projectId} cr={cr} milestones={milestones} />}
      {["submitted", "under_review", "needs_clarification"].includes(s) && (
        <ReasonDialog trigger="Decline" size="xs" variant="ghost" confirmVariant="destructive" title={`Decline CR-${cr.number}`} confirm="Decline" onSubmit={(t) => triageChange(projectId, cr.id, "decline", t)} />
      )}
      {s === "impact_review" && <ActionButton size="xs" variant="default" onRun={() => advanceChange(projectId, cr.id, "send_for_approval")}>Send for client approval</ActionButton>}
      {s === "impact_review" && cr.impact && !cr.impact.needsClientApproval && <ActionButton size="xs" onRun={() => advanceChange(projectId, cr.id, "approve_internal")}>Approve internally</ActionButton>}
      {s === "approved" && <ActionButton size="xs" variant="default" onRun={() => advanceChange(projectId, cr.id, "implement")}>Implement (update linked records)</ActionButton>}
    </div>
  )
}

function ImpactDialog({ projectId, cr, milestones }: Parameters<typeof ChangeControls>[0]) {
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<string[]>(cr.impact?.milestoneIds ?? [])
  const [shift, setShift] = useState(cr.impact?.dateShiftDays ?? 0)
  const [scope, setScope] = useState(cr.impact?.scope ?? "")
  const [effort, setEffort] = useState(cr.impact?.effortDays ?? 0)
  const [cost, setCost] = useState(cr.impact?.costDelta ?? 0)
  const { pending, run } = useAction()
  const needsClient = cost !== 0 || shift !== 0
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="xs" variant="outline" />}>{cr.impact ? "Edit impact review" : "Impact review"}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Impact review · CR-{cr.number}</DialogTitle>
          <DialogDescription>Mandatory before any decision. Nothing changes until the request is approved and implemented — baselines stay intact.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-xs font-medium">Affected milestones</legend>
            {milestones.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-[var(--brand)]" checked={sel.includes(m.id)} onChange={(e) => setSel(e.target.checked ? [...sel, m.id] : sel.filter((x) => x !== m.id))} />
                <span className="flex-1">{m.name}</span><span className="text-xs text-muted-foreground">{fmtDate(m.date)}</span>
              </label>
            ))}
          </fieldset>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Date shift (days)"><input type="number" className="field" value={shift} onChange={(e) => setShift(Number(e.target.value) || 0)} /></Field>
            <Field label="Effort (person-days)"><input type="number" className="field" value={effort} onChange={(e) => setEffort(Number(e.target.value) || 0)} /></Field>
            <Field label="Cost change (₹)"><input type="number" className="field" value={cost} onChange={(e) => setCost(Number(e.target.value) || 0)} /></Field>
          </div>
          <Field label="Scope impact"><textarea className="field" rows={2} value={scope} onChange={(e) => setScope(e.target.value)} /></Field>
          <p className={needsClient ? "rounded-lg bg-brand-soft p-2 text-xs" : "rounded-lg bg-muted p-2 text-xs"}>
            {needsClient ? `Alters ${cost ? `cost (${fmtINR(cost)})` : ""}${cost && shift ? " and " : ""}${shift ? `dates (${shift}d)` : ""} — needs client approval${cost ? " (Tier A, fresh sign-in)" : ""}.` : "No cost or date impact — may be approved internally (unless it changes scope)."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => run(() => saveImpact(projectId, cr.id, { milestoneIds: sel, dateShiftDays: shift, scope, effortDays: effort, costDelta: cost }), () => setOpen(false))}>Save impact review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ApprovalAdminControls({ projectId, id, isOwner }: { projectId: string; id: string; isOwner: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <ReasonDialog trigger="Withdraw" size="xs" variant="ghost" title="Withdraw approval request" confirm="Withdraw" onSubmit={(r) => withdrawApproval(projectId, id, r)} />
      {isOwner && (
        <ReasonDialog trigger="Record external approval" size="xs" title="Approval received outside the platform" description="Attach evidence (e.g. the approver's email). You are recorded as the recorder." label="Evidence" confirm="Record" onSubmit={(r) => recordExternalApproval(projectId, id, r)} />
      )}
    </div>
  )
}
