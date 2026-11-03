import { cn } from "@/lib/utils"
import type { ApprovalState, ChangeState, EstimateState, Health, Lifecycle, MilestoneState } from "@/lib/domain/types"
import { HEALTH_LABEL, LIFECYCLE_LABEL, MILESTONE_LABEL } from "@/lib/domain/rules"
import { Lock, Users, Globe2, FileLock2, PenLine, Layers } from "lucide-react"

type Tone = "ok" | "warn" | "bad" | "info" | "brand" | "muted"

const toneCls: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok ring-ok/20",
  warn: "bg-warn-soft text-warn ring-warn/25",
  bad: "bg-bad-soft text-bad ring-bad/20",
  info: "bg-info-soft text-info ring-info/20",
  brand: "bg-brand-soft text-brand ring-brand/20",
  muted: "bg-muted text-muted-foreground ring-border",
}

export function Pill({ tone = "muted", className, children, dot }: { tone?: Tone; className?: string; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", toneCls[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

const healthTone: Record<Health, Tone> = { on_track: "ok", at_risk: "warn", delayed: "bad" }

export function HealthBadge({ health, size = "md" }: { health?: Health; size?: "md" | "lg" }) {
  if (!health) return <Pill>No status</Pill>
  return (
    <Pill tone={healthTone[health]} dot className={size === "lg" ? "h-8 px-3.5 text-sm" : undefined}>
      {HEALTH_LABEL[health]}
    </Pill>
  )
}

const lifecycleTone: Partial<Record<Lifecycle, Tone>> = { active: "brand", proposal: "info", paused: "warn", cancelled: "bad", closing: "info" }
export function LifecycleBadge({ lifecycle }: { lifecycle: Lifecycle }) {
  return <Pill tone={lifecycleTone[lifecycle] ?? "muted"}>{LIFECYCLE_LABEL[lifecycle]}</Pill>
}

const msTone: Record<MilestoneState, Tone> = {
  planned: "muted",
  in_progress: "info",
  ready_for_review: "brand",
  changes_requested: "warn",
  accepted: "ok",
  dropped: "muted",
}
export function MilestoneStateBadge({ state }: { state: MilestoneState }) {
  return <Pill tone={msTone[state]}>{MILESTONE_LABEL[state]}</Pill>
}

const apTone: Record<ApprovalState, Tone> = { pending: "brand", approved: "ok", changes_requested: "warn", declined: "bad", withdrawn: "muted", superseded: "muted" }
export function ApprovalStateBadge({ state }: { state: ApprovalState }) {
  return <Pill tone={apTone[state]}>{state.replace("_", " ").replace(/^./, (c) => c.toUpperCase())}</Pill>
}

const crTone: Record<ChangeState, Tone> = {
  submitted: "info", under_review: "info", needs_clarification: "warn", impact_review: "brand",
  awaiting_client_approval: "brand", approved: "ok", implemented: "ok", declined: "bad", withdrawn: "muted",
}
export function ChangeStateBadge({ state }: { state: ChangeState }) {
  return <Pill tone={crTone[state]}>{state.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())}</Pill>
}

const estTone: Record<EstimateState, Tone> = { draft: "muted", internal_review: "info", shared: "brand", approved: "ok", declined: "bad", expired: "muted", withdrawn: "muted", superseded: "muted" }
export function EstimateStateBadge({ state }: { state: EstimateState }) {
  return <Pill tone={estTone[state]}>{state.replace("_", " ").replace(/^./, (c) => c.toUpperCase())}</Pill>
}

/** Staff-only audience badge (REQ-PUB-02). Clients see "Shared with you" instead. */
export function AudienceBadge({ kind, label }: { kind: "draft" | "team" | "workstream" | "named" | "client"; label: string }) {
  const Icon = { draft: PenLine, team: Lock, workstream: Layers, named: FileLock2, client: Globe2 }[kind]
  const tone: Tone = { draft: "muted", team: "warn", workstream: "info", named: "brand", client: "ok" }[kind] as Tone
  return (
    <Pill tone={tone}>
      <Icon className="size-3" aria-hidden />
      {label}
    </Pill>
  )
}

export function SharedWithYou() {
  return (
    <Pill tone="muted">
      <Users className="size-3" aria-hidden /> Shared with you
    </Pill>
  )
}
