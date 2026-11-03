"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { archiveProject, lifecycleAction, reopenProject, startClosing } from "@/lib/actions"
import type { Lifecycle } from "@/lib/domain/types"
import { ActionButton, ReasonDialog } from "@/components/shared/dialogs"
import { useAction } from "@/components/shared/use-action"

export function LifecycleControls({ projectId, lifecycle, isOwner, isDirector, cancelRequestedBy, viewerId }: { projectId: string; lifecycle: Lifecycle; isOwner: boolean; isDirector: boolean; cancelRequestedBy?: string; viewerId: string }) {
  if (!isDirector) return null
  const done = ["closed", "cancelled", "archived"].includes(lifecycle)
  return (
    <div className="flex flex-wrap gap-2">
      {isOwner && lifecycle === "active" && (
        <ReasonDialog trigger="Pause" title="Pause this project" description="Due dates will be flagged paused and overdue alerts suspended. All members are notified." confirm="Pause project" onSubmit={(r) => lifecycleAction(projectId, "pause", r)} />
      )}
      {isOwner && lifecycle === "active" && <ActionButton onRun={() => startClosing(projectId)}>Start closing</ActionButton>}
      {isOwner && lifecycle === "paused" && <ResumeDialog projectId={projectId} />}
      {isOwner && (lifecycle === "closed" || lifecycle === "cancelled") && <ActionButton variant="ghost" onRun={() => archiveProject(projectId)}>Archive</ActionButton>}
      {isOwner && !done && !cancelRequestedBy && (
        <ReasonDialog trigger="Request cancellation" variant="ghost" confirmVariant="destructive" title="Request cancellation" description="Another Director must confirm. Open items will close as Withdrawn and the project becomes read-only." confirm="Request cancellation" onSubmit={(r) => lifecycleAction(projectId, "request_cancel", r)} />
      )}
      {cancelRequestedBy && cancelRequestedBy !== viewerId && !done && (
        <ActionButton variant="destructive" onRun={() => lifecycleAction(projectId, "confirm_cancel", "")}>
          Confirm cancellation
        </ActionButton>
      )}
      {done && <ReasonDialog trigger="Reopen" title="Reopen project" description="Previous closure records are preserved." confirm="Reopen" onSubmit={(r) => reopenProject(projectId, r)} />}
    </div>
  )
}

function ResumeDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const [ok, setOk] = useState(false)
  const { pending, run } = useAction()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Resume</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resume project</DialogTitle>
          <DialogDescription>Before resuming, confirm the current milestone dates on the Plan tab are still right. Change any that moved — each change needs a written reason.</DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 accent-[var(--brand)]" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          I have confirmed or updated the current milestone dates.
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!ok || pending} onClick={() => run(() => lifecycleAction(projectId, "resume", "confirmed"), () => setOpen(false))}>Resume</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
