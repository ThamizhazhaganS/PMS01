"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { ShieldCheck, KeyRound, Info } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { ApprovalView } from "@/lib/data"
import type { ApprovalOutcome } from "@/lib/domain/types"
import { decideApproval } from "@/lib/actions"
import { fmtDate } from "@/lib/domain/rules"
import { useAction } from "./use-action"
import { Pill } from "./badges"

const LABEL: Record<ApprovalOutcome, string> = { approve: "Approve", changes: "Request changes", decline: "Decline" }

/**
 * Fixed vocabulary (UX-05): Approve · Request changes · Decline.
 * Tier A asks for a fresh one-time code at the moment of approval (REQ-APR-02).
 */
export function ApprovalDialog({ view, defaultOpen, trigger }: { view: ApprovalView; defaultOpen?: boolean; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen)
  const [outcome, setOutcome] = useState<ApprovalOutcome | null>(null)
  const [comment, setComment] = useState("")
  const [otp, setOtp] = useState("")
  const { pending, run } = useAction()
  const router = useRouter()
  const path = usePathname()

  const reset = () => {
    setOutcome(null)
    setComment("")
    setOtp("")
  }
  const close = (o: boolean) => {
    setOpen(o)
    if (!o) {
      reset()
      if (defaultOpen) router.replace(path)
    }
  }
  const needsComment = outcome && outcome !== "approve"
  const canSubmit = outcome && (!needsComment || comment.trim().length >= 3) && (view.tier === "B" || otp.length === 6)

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger render={<Button size="sm" />}>{trigger ?? "Review & decide"}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={view.tier === "A" ? "brand" : "muted"}>
              {view.tier === "A" ? <KeyRound className="size-3" /> : <ShieldCheck className="size-3" />}
              {view.tier === "A" ? "Needs a one-time code" : "One-click approval"}
            </Pill>
            {view.overdue ? <Pill tone="bad">Overdue</Pill> : <Pill>Due {fmtDate(view.due)}</Pill>}
          </div>
          <DialogTitle className="pt-1 text-lg">{view.title}</DialogTitle>
          <DialogDescription>{view.projectName}</DialogDescription>
        </DialogHeader>

        <dl className="divide-y rounded-lg border text-sm">
          {view.details.map((d) => (
            <div key={d.label} className="grid grid-cols-[8rem_1fr] gap-3 px-3 py-2">
              <dt className="text-muted-foreground">{d.label}</dt>
              <dd className="min-w-0 break-words">{d.value}</dd>
            </div>
          ))}
        </dl>
        {view.notice && (
          <p className="flex gap-2 rounded-lg bg-muted p-3 text-xs">
            <Info className="mt-0.5 size-3.5 shrink-0" /> {view.notice}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Viewing, downloading or commenting never counts as approval. Your decision is bound to this exact version.
        </p>

        {!view.canDecide ? (
          <p className="rounded-lg border p-3 text-sm">
            {view.myResponse ? "Your decision is recorded." : `Only the designated approver${view.approverNames.length > 1 ? "s" : ""} (${view.approverNames.join(", ")}) can decide.`}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Your decision">
              {(["approve", "changes", "decline"] as ApprovalOutcome[]).map((o) => (
                <Button
                  key={o}
                  role="radio"
                  aria-checked={outcome === o}
                  variant={outcome === o ? (o === "decline" ? "destructive" : "default") : "outline"}
                  onClick={() => setOutcome(o)}
                  className="h-10"
                >
                  {LABEL[o]}
                </Button>
              ))}
            </div>
            {outcome && (
              <label className="grid gap-1.5 text-xs font-medium">
                Comment {needsComment ? "(required)" : "(optional)"}
                <textarea className="field" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
              </label>
            )}
            {outcome && view.tier === "A" && (
              <div className="rounded-lg border border-brand/30 bg-brand-soft/50 p-3">
                <label className="grid gap-1.5 text-xs font-medium">
                  Confirm it is you — enter the 6-digit code we just emailed
                  <input
                    className="field font-mono tracking-[0.4em]"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                  />
                </label>
                <p className="mt-1.5 text-[11px] text-muted-foreground">Dev build: the code is 123456.</p>
              </div>
            )}
            <Button
              className="h-10 w-full"
              disabled={!canSubmit || pending}
              onClick={() => run(() => decideApproval(view.projectId, view.id, outcome!, comment, otp), () => close(false))}
            >
              {outcome ? `Submit: ${LABEL[outcome]}` : "Choose a decision"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
