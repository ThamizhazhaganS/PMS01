"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { submitSurvey } from "@/lib/actions"
import { SURVEY_QUESTIONS } from "@/lib/domain/rules"
import { useAction } from "@/components/shared/use-action"
import { cn } from "@/lib/utils"

type Key = (typeof SURVEY_QUESTIONS)[number][0]

/** Short closure feedback for the Client Lead (REQ-CLS-04). Can be completed or skipped. */
export function SurveyDialog({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [open, setOpen] = useState(false)
  const [scores, setScores] = useState<Partial<Record<Key, number>>>({})
  const [comments, setComments] = useState("")
  const { pending, run } = useAction()
  const complete = SURVEY_QUESTIONS.every(([k]) => scores[k])
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Give feedback</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How did it go?</DialogTitle>
          <DialogDescription>{projectName} — five quick ratings. 1 = poor, 5 = excellent.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {SURVEY_QUESTIONS.map(([k, label]) => (
            <fieldset key={k}>
              <legend className="mb-1.5 text-sm font-medium">{label}</legend>
              <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={scores[k] === n}
                    aria-label={`${label}: ${n}`}
                    onClick={() => setScores({ ...scores, [k]: n })}
                    className={cn("h-10 rounded-lg border text-sm font-medium tabular-nums transition hover:border-foreground/30", scores[k] === n && "border-brand bg-brand text-brand-foreground")}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Anything else? (optional)</span>
            <textarea className="field" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={pending} onClick={() => run(() => submitSurvey(projectId, { skip: true }), () => setOpen(false))}>
            Skip
          </Button>
          <Button
            disabled={pending || !complete}
            onClick={() => run(() => submitSurvey(projectId, { ...(scores as Record<Key, number>), comments }), () => setOpen(false))}
          >
            Send feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
