"use client"

import { CheckCircle2, CircleHelp, ListTodo, Stamp } from "lucide-react"
import type { NeedsItem } from "@/lib/data"
import { answerClarification, setActionState } from "@/lib/actions"
import { fmtDate } from "@/lib/domain/rules"
import { ApprovalDialog } from "./approval-dialog"
import { ActionButton, ReasonDialog } from "./dialogs"
import { Pill } from "./badges"
import { cn } from "@/lib/utils"

const ICON = { approval: Stamp, action: ListTodo, clarification: CircleHelp }

/** One list, one primary button per item (UX-02). */
export function NeedsList({ items, showProject, openId, emptyText = "Nothing needs you right now." }: { items: NeedsItem[]; showProject?: boolean; openId?: string; emptyText?: string }) {
  if (items.length === 0)
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <CheckCircle2 className="size-5 text-ok" /> {emptyText}
      </div>
    )
  return (
    <ul className="divide-y rounded-lg border">
      {items.map((n) => {
        const Icon = ICON[n.kind]
        return (
          <li key={n.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", n.kind === "approval" ? "bg-brand-soft text-brand" : "bg-muted text-muted-foreground")}>
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-snug font-medium">{n.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {showProject && <span className="font-medium text-foreground/80">{n.projectName}</span>}
                  {showProject && <span aria-hidden>·</span>}
                  <span>{n.detail}</span>
                  {n.due && (n.overdue ? <Pill tone="bad">Overdue · {fmtDate(n.due)}</Pill> : <span>· due {fmtDate(n.due)}</span>)}
                </div>
              </div>
            </div>
            <div className="shrink-0 sm:pl-3">
              {n.kind === "approval" && n.approval && <ApprovalDialog view={n.approval} defaultOpen={openId === n.id} />}
              {n.kind === "action" && (
                <ActionButton variant="default" onRun={() => setActionState(n.projectId, n.id, "done")}>
                  Mark done
                </ActionButton>
              )}
              {n.kind === "clarification" && (
                <ReasonDialog
                  trigger="Answer"
                  variant="default"
                  title="Answer the clarification"
                  description={n.detail}
                  label="Your answer"
                  minLength={3}
                  confirm="Send answer"
                  onSubmit={(t) => answerClarification(n.projectId, n.id, t)}
                />
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
