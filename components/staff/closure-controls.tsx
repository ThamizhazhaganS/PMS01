"use client"

import type { ClosureKey } from "@/lib/domain/types"
import { finalizeClosure, requestFinalAcceptance, setClosureItem } from "@/lib/actions"
import { ActionButton, ReasonDialog } from "@/components/shared/dialogs"

export function ClosureItemControls({ projectId, itemKey, state, label }: { projectId: string; itemKey: ClosureKey; state: "pending" | "met" | "waived"; label: string }) {
  if (state !== "pending") return <ActionButton size="xs" variant="ghost" onRun={() => setClosureItem(projectId, itemKey, "pending")}>Reset</ActionButton>
  return (
    <div className="flex gap-1.5">
      <ActionButton size="xs" onRun={() => setClosureItem(projectId, itemKey, "met")}>Mark met</ActionButton>
      <ReasonDialog trigger="Waive" size="xs" variant="ghost" title={`Waive “${label}”`} description="Waivers are recorded on the closure record with your name." label="Why is this being waived?" confirm="Waive" onSubmit={(r) => setClosureItem(projectId, itemKey, "waived", r)} />
    </div>
  )
}

export function FinalAcceptanceButton({ projectId, again }: { projectId: string; again?: boolean }) {
  return <ActionButton size="sm" onRun={() => requestFinalAcceptance(projectId)}>{again ? "Request final acceptance again" : "Request final acceptance"}</ActionButton>
}

export function FinalizeButton({ projectId, disabled }: { projectId: string; disabled?: boolean }) {
  return <ActionButton size="sm" variant="default" disabled={disabled} onRun={() => finalizeClosure(projectId)}>Close project</ActionButton>
}
