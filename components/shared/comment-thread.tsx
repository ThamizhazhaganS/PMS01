"use client"

import { useState } from "react"
import { CheckCircle2, ListPlus, Lock, MessageSquare, Pencil, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { addComment, commentToAction, editComment, setThreadResolved } from "@/lib/actions"
import { fmtDateTime } from "@/lib/domain/rules"
import { useAction } from "./use-action"
import { cn } from "@/lib/utils"

export interface ThreadView {
  id: string
  audience: "shared" | "team"
  purpose: "discussion" | "correction"
  resolved: boolean
  comments: { id: string; author: string; body: string; at: string; editedAt?: string; mine: boolean }[]
}

/**
 * Threads carry their own audience. Staff replies default to Team (internal)
 * unless explicitly switched to client-visible (REQ-COM-02).
 */
export function CommentThreads({ projectId, subject, threads, staff }: { projectId: string; subject: { kind: "publication" | "document"; id: string }; threads: ThreadView[]; staff: boolean }) {
  const [body, setBody] = useState("")
  const [aud, setAud] = useState<"shared" | "team">(staff ? "team" : "shared")
  const { pending, run } = useAction()
  const total = threads.reduce((s, t) => s + t.comments.length, 0)
  return (
    <details className="group mt-3 rounded-lg border">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
        <MessageSquare className="size-3.5" /> {total} comment{total === 1 ? "" : "s"}
      </summary>
      <div className="space-y-3 border-t p-3">
        {threads.map((t) => (
          <div key={t.id} className={cn("rounded-lg p-2", t.audience === "team" ? "bg-warn-soft/50" : "bg-muted/60")}>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              {t.audience === "team" ? <><Lock className="size-3" /> Team only — never shown to clients</> : t.purpose === "correction" ? "Correction request" : "Shared with the client"}
              {t.resolved && " · resolved"}
              {staff && (
                <button className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-background hover:text-foreground disabled:opacity-50" disabled={pending} onClick={() => run(() => setThreadResolved(projectId, t.id, !t.resolved))}>
                  {t.resolved ? <><RotateCcw className="size-3" /> Reopen</> : <><CheckCircle2 className="size-3" /> Mark resolved</>}
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {t.comments.map((c) => (
                <CommentItem key={c.id} projectId={projectId} threadId={t.id} c={c} staff={staff} />
              ))}
            </ul>
          </div>
        ))}
        <div className="grid gap-2">
          <textarea aria-label="Write a comment" className="field" rows={2} placeholder="Write a comment…" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {staff ? (
              <select aria-label="Who can see this comment" className="field h-8 w-auto text-xs" value={aud} onChange={(e) => setAud(e.target.value as "shared" | "team")}>
                <option value="team">Team only (internal)</option>
                <option value="shared">Shared with the client</option>
              </select>
            ) : (
              <span className="text-[11px] text-muted-foreground">Commenting is not an approval.</span>
            )}
            <Button size="sm" disabled={pending || body.trim().length < 2} onClick={() => run(() => addComment(projectId, subject, body, aud), () => setBody(""))}>
              Comment
            </Button>
          </div>
        </div>
      </div>
    </details>
  )
}

function CommentItem({ projectId, threadId, c, staff }: { projectId: string; threadId: string; c: ThreadView["comments"][number]; staff: boolean }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(c.body)
  const { pending, run } = useAction()
  return (
    <li className="group/c text-sm">
      <div className="flex items-center gap-1.5">
        <span className="font-medium">{c.author}</span>
        <span className="text-[11px] text-muted-foreground">{fmtDateTime(c.at)}{c.editedAt && " · edited"}</span>
        <span className="ml-auto flex gap-0.5">
          {c.mine && !editing && (
            <button className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Edit comment" onClick={() => { setText(c.body); setEditing(true) }}>
              <Pencil className="size-3" />
            </button>
          )}
          {staff && (
            <button className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50" aria-label="Make this an action" title="Make this an action" disabled={pending} onClick={() => run(() => commentToAction(projectId, threadId, c.id))}>
              <ListPlus className="size-3" />
            </button>
          )}
        </span>
      </div>
      {editing ? (
        <div className="mt-1 grid gap-1.5">
          <textarea aria-label="Edit comment" className="field" rows={2} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex justify-end gap-1.5">
            <Button size="xs" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="xs" disabled={pending || text.trim().length < 2} onClick={() => run(() => editComment(projectId, threadId, c.id, text), () => setEditing(false))}>Save</Button>
          </div>
        </div>
      ) : (
        <p className="mt-0.5">{c.body}</p>
      )}
    </li>
  )
}
