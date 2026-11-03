"use client"

import { useState } from "react"
import { Lock, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { addComment } from "@/lib/actions"
import { fmtDateTime } from "@/lib/domain/rules"
import { useAction } from "./use-action"
import { cn } from "@/lib/utils"

export interface ThreadView {
  id: string
  audience: "shared" | "team"
  purpose: "discussion" | "correction"
  resolved: boolean
  comments: { id: string; author: string; body: string; at: string }[]
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
              {t.audience === "team" ? <><Lock className="size-3" /> Team only — never shown to clients</> : t.purpose === "correction" ? "Correction request" : "Shared thread"}
              {t.resolved && " · resolved"}
            </div>
            <ul className="space-y-2">
              {t.comments.map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="font-medium">{c.author}</span> <span className="text-[11px] text-muted-foreground">{fmtDateTime(c.at)}</span>
                  <p className="mt-0.5">{c.body}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="grid gap-2">
          <textarea aria-label="Write a comment" className="field" rows={2} placeholder="Write a comment…" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {staff ? (
              <select aria-label="Comment audience" className="field h-8 w-auto text-xs" value={aud} onChange={(e) => setAud(e.target.value as "shared" | "team")}>
                <option value="team">Team only (internal)</option>
                <option value="shared">Client-visible</option>
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
