import { Ban, CirclePause, OctagonAlert } from "lucide-react"
import type { Project } from "@/lib/domain/types"
import { userById } from "@/lib/data"
import { ROLE_LABEL, fmtDateTime, relDays } from "@/lib/domain/rules"

const who = (id: string) => {
  const u = userById(id)
  return u ? `${u.name} (${ROLE_LABEL[u.kind]})` : "Unknown"
}

/**
 * Why a project is on hold or stopping: the reason, when, and who decided.
 * Shown the same way to Morphoverse staff and to everyone on the client side.
 */
export function LifecycleNotice({ project: p, client }: { project: Project; client?: boolean }) {
  return (
    <>
      {p.lifecycle === "paused" && p.pause && (
        <div className="mb-4 flex gap-3 rounded-xl border border-warn/30 bg-warn-soft p-4 text-sm" role="status">
          <CirclePause className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
          <div>
            <p className="font-medium">This project is on hold</p>
            <p className="mt-1">
              <span className="text-muted-foreground">Reason: </span>
              {p.pause.reason}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Paused {relDays(p.pause.at)} · {fmtDateTime(p.pause.at)} · by {who(p.pause.by)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {client ? "Due dates are on hold too. Morphoverse will let you know before work restarts." : "Due dates are flagged paused and overdue alerts are suspended."}
            </p>
          </div>
        </div>
      )}
      {p.cancelRequest && p.lifecycle !== "cancelled" && (
        <div className="mb-4 flex gap-3 rounded-xl border border-bad/30 bg-bad-soft p-4 text-sm" role="status">
          <OctagonAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
          <div>
            <p className="font-medium">Cancellation requested</p>
            <p className="mt-1">
              <span className="text-muted-foreground">Reason: </span>
              {p.cancelRequest.reason}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Requested {relDays(p.cancelRequest.at)} · {fmtDateTime(p.cancelRequest.at)} · by {who(p.cancelRequest.by)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Waiting for the Morphoverse Admin to confirm. Until then the project continues as normal.</p>
          </div>
        </div>
      )}
      {p.lifecycle === "cancelled" && (
        <div className="mb-4 flex gap-3 rounded-xl border bg-muted p-4 text-sm" role="status">
          <Ban className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">This project was cancelled</p>
            {p.cancelRequest && (
              <>
                <p className="mt-1">
                  <span className="text-muted-foreground">Reason: </span>
                  {p.cancelRequest.reason}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Requested {fmtDateTime(p.cancelRequest.at)} by {who(p.cancelRequest.by)}
                  {p.cancelled && <> · confirmed {fmtDateTime(p.cancelled.at)} by {who(p.cancelled.by)}</>}
                </p>
              </>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Records are kept and can still be read, but nothing can be changed.</p>
          </div>
        </div>
      )}
    </>
  )
}
