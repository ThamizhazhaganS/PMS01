"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { addAction, addBlocker, changeMilestoneDate, milestoneTransition, resolveBlocker, setActionState } from "@/lib/actions"
import type { Audience, BlockerType, DateLinkKind, MilestoneState } from "@/lib/domain/types"
import { fmtDate } from "@/lib/domain/rules"
import { ActionButton } from "@/components/shared/dialogs"
import { Field } from "@/components/shared/ui"
import { useAction } from "@/components/shared/use-action"

type Opt = { id: string; label: string }

export function MilestoneActions(props: {
  projectId: string
  m: { id: string; name: string; state: MilestoneState; acceptance: "client" | "internal"; currentDate: string; baselineDate?: string; criteria: string }
  canPublish: boolean
  isDirector: boolean
  approvers: Opt[]
  blockers: Opt[]
  changes: Opt[]
}) {
  const { projectId, m } = props
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {m.state === "planned" && <ActionButton size="xs" onRun={() => milestoneTransition(projectId, m.id, "in_progress")}>Start</ActionButton>}
      {(m.state === "in_progress" || m.state === "changes_requested") &&
        (m.acceptance === "client" ? (
          props.canPublish ? <ReviewDialog {...props} /> : <span className="text-[11px] text-muted-foreground">Needs publish right</span>
        ) : (
          <ActionButton size="xs" onRun={() => milestoneTransition(projectId, m.id, "ready_for_review")}>Ready for review</ActionButton>
        ))}
      {m.state === "ready_for_review" && m.acceptance === "internal" && props.isDirector && (
        <ActionButton size="xs" variant="default" onRun={() => milestoneTransition(projectId, m.id, "accepted")}>Accept (internal)</ActionButton>
      )}
      {m.state === "ready_for_review" && m.acceptance === "client" && <span className="text-[11px] text-muted-foreground">Awaiting client</span>}
      {m.state !== "accepted" && m.state !== "dropped" && <DateDialog {...props} />}
    </div>
  )
}

function ReviewDialog({ projectId, m, approvers }: Parameters<typeof MilestoneActions>[0]) {
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<string[]>(approvers.slice(0, 1).map((a) => a.id))
  const { pending, run } = useAction()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="xs" />}>Ready for review</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request client acceptance</DialogTitle>
          <DialogDescription>
            &ldquo;Ready for review&rdquo; is not &ldquo;Accepted&rdquo;. Only a designated client approver can accept. Approver is a designation on this request — not a role.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-muted p-3 text-sm">
          <div className="eyebrow mb-1">Acceptance criteria</div>
          {m.criteria || <span className="text-bad">Missing — required before review.</span>}
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-xs font-medium">Designated approver(s) — client members who can see this milestone</legend>
          {approvers.length === 0 && <p className="text-sm text-bad">No eligible client approver can see this milestone.</p>}
          {approvers.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[var(--brand)]" checked={sel.includes(a.id)} onChange={(e) => setSel(e.target.checked ? [...sel, a.id] : sel.filter((x) => x !== a.id))} />
              {a.label}
            </label>
          ))}
        </fieldset>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending || sel.length === 0} onClick={() => run(() => milestoneTransition(projectId, m.id, "ready_for_review", sel), () => setOpen(false))}>
            Request approval (Tier B)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DateDialog({ projectId, m, blockers, changes }: Parameters<typeof MilestoneActions>[0]) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(m.currentDate)
  const [kind, setKind] = useState<DateLinkKind>(blockers.length ? "blocker" : "team_adjustment")
  const [link, setLink] = useState("")
  const [reason, setReason] = useState("")
  const { pending, run } = useAction()
  const opts = kind === "blocker" ? blockers : kind === "change_request" ? changes : []
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="xs" variant="ghost" />}>Change date</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change current date</DialogTitle>
          <DialogDescription>
            {m.name}. Baseline {m.baselineDate ? fmtDate(m.baselineDate) : "not yet frozen"} is never overwritten. No date moves silently — a written reason is required.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="New current date">
            <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Linked to">
            <select className="field" value={kind} onChange={(e) => { setKind(e.target.value as DateLinkKind); setLink("") }}>
              <option value="blocker">A blocker</option>
              <option value="change_request">A change request</option>
              <option value="team_adjustment">Team adjustment</option>
            </select>
          </Field>
          {kind !== "team_adjustment" && (
            <Field label={kind === "blocker" ? "Blocker" : "Change request"}>
              <select className="field" value={link} onChange={(e) => setLink(e.target.value)}>
                <option value="">Choose…</option>
                {opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
          )}
          <Field label="Reason (visible to everyone who can see this milestone)" hint="Required · at least 10 characters">
            <textarea className="field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => run(() => changeMilestoneDate(projectId, m.id, date, reason, kind, link || undefined), () => setOpen(false))}>
            Change date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AddBlockerDialog({ projectId, milestones, people }: { projectId: string; milestones: { id: string; label: string; date: string }[]; people: Opt[] }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [type, setType] = useState<BlockerType>("client input")
  const [resp, setResp] = useState(people[0]?.id ?? "")
  const [resolution, setResolution] = useState("")
  const [sel, setSel] = useState<string[]>([])
  const [delay, setDelay] = useState(0)
  const { pending, run } = useAction()
  const affected = milestones.filter((m) => sel.includes(m.id))
  const shifted = (d: string) => new Date(new Date(`${d}T12:00:00Z`).getTime() + delay * 864e5).toISOString().slice(0, 10)
  const latest = milestones.map((m) => (sel.includes(m.id) ? shifted(m.date) : m.date)).sort().at(-1)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Raise blocker</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Raise a blocker</DialogTitle>
          <DialogDescription>Linked milestones show a Blocked indicator. Dates do not move automatically.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="What is blocking progress?"><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Type">
              <select className="field" value={type} onChange={(e) => setType(e.target.value as BlockerType)}>
                {["client decision", "client input", "third party", "internal"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Responsible person">
              <select className="field" value={resp} onChange={(e) => setResp(e.target.value)}>
                {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Expected resolution"><input type="date" className="field" value={resolution} onChange={(e) => setResolution(e.target.value)} /></Field>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-xs font-medium">Affected milestones</legend>
            {milestones.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-[var(--brand)]" checked={sel.includes(m.id)} onChange={(e) => setSel(e.target.checked ? [...sel, m.id] : sel.filter((x) => x !== m.id))} />
                <span className="flex-1">{m.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{fmtDate(m.date)}</span>
              </label>
            ))}
          </fieldset>
          {affected.length > 0 && (
            <div className="rounded-lg border border-dashed p-3 text-sm">
              <div className="eyebrow mb-2">Impact preview (nothing is changed)</div>
              <label className="flex items-center gap-2 text-xs">If it slips by <input type="number" min={0} className="field h-7 w-20" value={delay} onChange={(e) => setDelay(Number(e.target.value) || 0)} /> days:</label>
              <ul className="mt-2 space-y-1 text-xs">
                {affected.map((m) => <li key={m.id}>{m.label}: {fmtDate(m.date)} → <b>{fmtDate(shifted(m.date))}</b></li>)}
              </ul>
              <p className="mt-2 text-xs">Expected completion would be <b>{fmtDate(latest)}</b>.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => run(() => addBlocker(projectId, { reason, type, responsibleId: resp, expectedResolution: resolution, milestoneIds: sel }), () => setOpen(false))}>Raise blocker</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ResolveBlocker({ projectId, id }: { projectId: string; id: string }) {
  return <ActionButton size="xs" onRun={() => resolveBlocker(projectId, id)}>Resolve</ActionButton>
}

export function AddActionDialog({ projectId, people, audiences }: { projectId: string; people: Opt[]; audiences: { label: string; value: Audience }[] }) {
  const [open, setOpen] = useState(false)
  const [desc, setDesc] = useState("")
  const [owner, setOwner] = useState(people[0]?.id ?? "")
  const [due, setDue] = useState("")
  const [aud, setAud] = useState(0)
  const { pending, run } = useAction()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Add action</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign an action</DialogTitle>
          <DialogDescription>Client-owned actions appear in their Needs You list.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Action"><input className="field" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Owner">
              <select className="field" value={owner} onChange={(e) => setOwner(e.target.value)}>
                {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Due (optional)"><input type="date" className="field" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          </div>
          <Field label="Audience">
            <select className="field" value={aud} onChange={(e) => setAud(Number(e.target.value))}>
              {audiences.map((a, i) => <option key={i} value={i}>{a.label}</option>)}
            </select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => run(() => addAction(projectId, { description: desc, ownerId: owner, due, audience: audiences[aud].value }), () => { setOpen(false); setDesc("") })}>Assign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ActionStateButtons({ projectId, id, state }: { projectId: string; id: string; state: "open" | "done" | "cancelled" }) {
  if (state !== "open") return <ActionButton size="xs" variant="ghost" onRun={() => setActionState(projectId, id, "open")}>Reopen</ActionButton>
  return (
    <div className="flex gap-1">
      <ActionButton size="xs" onRun={() => setActionState(projectId, id, "done")}>Done</ActionButton>
      <ActionButton size="xs" variant="ghost" onRun={() => setActionState(projectId, id, "cancelled")}>Cancel</ActionButton>
    </div>
  )
}
