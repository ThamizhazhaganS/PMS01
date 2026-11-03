"use client"

import { useState } from "react"
import { MessageSquarePlus } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { addComment, requestAccess, submitChange, withdrawChange } from "@/lib/actions"
import type { ChangeCategory } from "@/lib/domain/types"
import { ActionButton, ReasonDialog } from "@/components/shared/dialogs"
import { Field } from "@/components/shared/ui"
import { useAction } from "@/components/shared/use-action"

/** The single client entry point for change: "Request a change" (UX-05). */
export function RequestChangeButton({ projectId, decisions, defaultDecision, disabled, compact }: { projectId: string; decisions: { id: string; statement: string }[]; defaultDecision?: string; disabled?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<ChangeCategory>(defaultDecision ? "revisit decision" : "change scope")
  const [what, setWhat] = useState("")
  const [why, setWhy] = useState("")
  const [timing, setTiming] = useState("")
  const [dec, setDec] = useState(defaultDecision ?? "")
  const { pending, run } = useAction()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger disabled={disabled} render={<Button size={compact ? "xs" : "default"} variant={compact ? "ghost" : "outline"} className={compact ? undefined : "h-9"} />}>
        {!compact && <MessageSquarePlus />} Request a change
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a change</DialogTitle>
          <DialogDescription>Morphoverse reviews every request and shows you the impact on dates, scope and cost before anything changes.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="What kind of change?">
            <select className="field" value={category} onChange={(e) => setCategory(e.target.value as ChangeCategory)}>
              <option value="revisit decision">Revisit a decision</option>
              <option value="change date">Change a date</option>
              <option value="change scope">Change scope</option>
              <option value="other">Other</option>
            </select>
          </Field>
          {category === "revisit decision" && (
            <Field label="Which decision?">
              <select className="field" value={dec} onChange={(e) => setDec(e.target.value)}>
                <option value="">Choose…</option>
                {decisions.map((d) => <option key={d.id} value={d.id}>{d.statement}</option>)}
              </select>
            </Field>
          )}
          <Field label="What should change?"><textarea className="field" rows={2} value={what} onChange={(e) => setWhat(e.target.value)} /></Field>
          <Field label="Why?"><textarea className="field" rows={2} value={why} onChange={(e) => setWhy(e.target.value)} /></Field>
          <Field label="Preferred timing (optional)"><input className="field" value={timing} onChange={(e) => setTiming(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => run(() => submitChange(projectId, { category, what, why, timing, linkedDecisionId: category === "revisit decision" ? dec || undefined : undefined }), () => { setOpen(false); setWhat(""); setWhy("") })}>Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RequestCorrection({ projectId, pubId, disabled }: { projectId: string; pubId: string; disabled?: boolean }) {
  if (disabled) return null
  return (
    <ReasonDialog
      trigger="Request a correction"
      size="xs"
      variant="ghost"
      title="Request a correction"
      description="The record stays as published until Morphoverse publishes a revised version."
      label="What is incorrect?"
      minLength={5}
      confirm="Send"
      onSubmit={(t) => addComment(projectId, { kind: "publication", id: pubId }, t, "shared", "correction")}
    />
  )
}

export function RequestAccessButton({ projectId, docId, disabled }: { projectId: string; docId: string; disabled?: boolean }) {
  if (disabled) return null
  return (
    <ReasonDialog trigger="Request access" size="xs" title="Request access to a restricted item" description="The item owner decides. The request and decision are logged." label="Why do you need it?" confirm="Request access" onSubmit={(r) => requestAccess(projectId, docId, r)} />
  )
}

export function WithdrawChange({ projectId, id }: { projectId: string; id: string }) {
  return <ActionButton size="xs" variant="ghost" onRun={() => withdrawChange(projectId, id)}>Withdraw</ActionButton>
}
