"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { postStatus } from "@/lib/actions"
import type { Health } from "@/lib/domain/types"
import { HEALTH_LABEL } from "@/lib/domain/rules"
import { Field } from "@/components/shared/ui"
import { useAction } from "@/components/shared/use-action"
import { cn } from "@/lib/utils"

const TONE: Record<Health, string> = { on_track: "data-[on=true]:bg-ok-soft data-[on=true]:text-ok data-[on=true]:ring-ok/40", at_risk: "data-[on=true]:bg-warn-soft data-[on=true]:text-warn data-[on=true]:ring-warn/40", delayed: "data-[on=true]:bg-bad-soft data-[on=true]:text-bad data-[on=true]:ring-bad/40" }

export function StatusDialog({ projectId, current }: { projectId: string; current?: { text: string; health: Health; explanation?: string; nextSteps: string } }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(current?.text ?? "")
  const [health, setHealth] = useState<Health>(current?.health ?? "on_track")
  const [explanation, setExplanation] = useState(current?.explanation ?? "")
  const [nextSteps, setNextSteps] = useState(current?.nextSteps ?? "")
  const { pending, run } = useAction()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Update status</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Status statement</DialogTitle>
          <DialogDescription>Written by a person, never computed. Clients see this first.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div role="radiogroup" aria-label="Health" className="grid grid-cols-3 gap-2">
            {(Object.keys(HEALTH_LABEL) as Health[]).map((h) => (
              <button key={h} role="radio" aria-checked={health === h} data-on={health === h} onClick={() => setHealth(h)} className={cn("h-10 rounded-lg text-sm font-medium ring-1 ring-border transition ring-inset", TONE[h])}>
                {HEALTH_LABEL[h]}
              </button>
            ))}
          </div>
          <Field label="Where the project stands">
            <textarea className="field" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          {health !== "on_track" && (
            <Field label={`Why ${HEALTH_LABEL[health]}?`} hint="Required for At Risk and Delayed.">
              <textarea className="field" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
            </Field>
          )}
          <Field label="Morphoverse next steps">
            <textarea className="field" rows={2} value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => run(() => postStatus(projectId, { text, health, explanation, nextSteps }), () => setOpen(false))}>
            Publish statement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
