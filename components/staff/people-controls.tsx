"use client"

import { Switch } from "@/components/ui/switch"
import { decideAccess, removeMember, setPublishRight, toggleWorkstream } from "@/lib/actions"
import { ActionButton } from "@/components/shared/dialogs"
import { useAction } from "@/components/shared/use-action"
import { cn } from "@/lib/utils"

export function WorkstreamChips({ projectId, userId, all, mine, editable }: { projectId: string; userId: string; all: { id: string; name: string }[]; mine: string[]; editable: boolean }) {
  const { pending, run } = useAction()
  return (
    <div className="flex flex-wrap gap-1">
      {all.map((w) => {
        const on = mine.includes(w.id)
        return (
          <button
            key={w.id}
            disabled={!editable || pending}
            aria-pressed={on}
            onClick={() => run(() => toggleWorkstream(projectId, userId, w.id))}
            className={cn("rounded-full px-2 py-0.5 text-xs ring-1 ring-inset transition disabled:cursor-default", on ? "bg-info-soft text-info ring-info/30" : "text-muted-foreground ring-border", editable && "hover:ring-foreground/30")}
          >
            {w.name}
          </button>
        )
      })}
    </div>
  )
}

export function PublishRightSwitch({ projectId, userId, value, editable }: { projectId: string; userId: string; value: boolean; editable: boolean }) {
  const { pending, run } = useAction()
  return <Switch aria-label="Publish right" checked={value} disabled={!editable || pending} onCheckedChange={(v) => run(() => setPublishRight(projectId, userId, !!v))} />
}

export function RemoveMember({ projectId, userId }: { projectId: string; userId: string }) {
  return <ActionButton size="xs" variant="ghost" onRun={() => removeMember(projectId, userId)}>Remove</ActionButton>
}

export function AccessRequestButtons({ projectId, id }: { projectId: string; id: string }) {
  return (
    <div className="flex gap-1.5">
      <ActionButton size="xs" variant="default" onRun={() => decideAccess(projectId, id, true)}>Grant</ActionButton>
      <ActionButton size="xs" onRun={() => decideAccess(projectId, id, false)}>Decline</ActionButton>
    </div>
  )
}
