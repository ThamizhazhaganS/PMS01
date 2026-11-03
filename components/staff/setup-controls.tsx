"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { addMember, addMilestone, addWorkstream } from "@/lib/actions"
import type { ProjectRole } from "@/lib/domain/types"
import { Field } from "@/components/shared/ui"
import { ReasonDialog } from "@/components/shared/dialogs"
import { useAction } from "@/components/shared/use-action"

type Opt = { id: string; name: string }

export function AddMilestoneDialog({ projectId, phases, workstreams, members, clients, baselined, changes }: { projectId: string; phases: Opt[]; workstreams: Opt[]; members: Opt[]; clients: Opt[]; baselined: boolean; changes: Opt[] }) {
  const [open, setOpen] = useState(false)
  const blank = { name: "", phaseId: phases[3]?.id ?? phases[0]?.id ?? "", workstreamId: "", ownerId: members[0]?.id ?? "", counterpartId: "", acceptance: "client" as "client" | "internal", criteria: "", date: "", changeRequestId: "" }
  const [f, setF] = useState(blank)
  const { pending, run } = useAction()
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Add milestone</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a milestone</DialogTitle>
          <DialogDescription>
            {baselined ? "The plan is baselined: new commitments need an approved change request." : "Its baseline date freezes when the first estimate is approved."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Name"><input className="field" value={f.name} onChange={set("name")} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phase"><select className="field" value={f.phaseId} onChange={set("phaseId")}>{phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Date"><input type="date" className="field" value={f.date} onChange={set("date")} /></Field>
            <Field label="Audience"><select className="field" value={f.workstreamId} onChange={set("workstreamId")}><option value="">Client-wide</option>{workstreams.map((w) => <option key={w.id} value={w.id}>Workstream · {w.name}</option>)}</select></Field>
            <Field label="Acceptance"><select className="field" value={f.acceptance} onChange={set("acceptance")}><option value="client">Client acceptance</option><option value="internal">Internal acceptance</option></select></Field>
            <Field label="Owner"><select className="field" value={f.ownerId} onChange={set("ownerId")}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
            <Field label="Client counterpart (optional)"><select className="field" value={f.counterpartId} onChange={set("counterpartId")}><option value="">None</option>{clients.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
          </div>
          <Field label={`Acceptance criteria${f.acceptance === "client" ? " (required)" : ""}`}><textarea className="field" rows={2} value={f.criteria} onChange={set("criteria")} /></Field>
          {baselined && (
            <Field label="Approved change request">
              <select className="field" value={f.changeRequestId} onChange={set("changeRequestId")}>
                <option value="">Choose…</option>
                {changes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => run(() => addMilestone(projectId, { ...f, workstreamId: f.workstreamId || undefined, counterpartId: f.counterpartId || undefined, changeRequestId: f.changeRequestId || undefined }), () => { setOpen(false); setF(blank) })}>Add milestone</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AddMemberDialog({ projectId, candidates, workstreams }: { projectId: string; candidates: (Opt & { side: "staff" | "client"; kind: string })[]; workstreams: Opt[] }) {
  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState(candidates[0]?.id ?? "")
  const [ws, setWs] = useState<string[]>([])
  const cand = candidates.find((c) => c.id === userId)
  const roles: { value: ProjectRole; label: string }[] =
    cand?.side === "staff"
      ? cand.kind === "director" ? [{ value: "director", label: "Director" }, { value: "team", label: "Team Member" }] : [{ value: "team", label: "Team Member" }]
      : [{ value: "client_stakeholder", label: "Client Stakeholder" }, { value: "client_lead", label: "Client Lead" }]
  const [role, setRole] = useState<ProjectRole>(roles[0]?.value ?? "team")
  const { pending, run } = useAction()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Add member</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a project member</DialogTitle>
          <DialogDescription>Membership reveals only the project shell. Workstreams decide what they can read. The grant is logged.</DialogDescription>
        </DialogHeader>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Everyone eligible is already a member. Ask an Admin to invite new users.</p>
        ) : (
          <div className="grid gap-3">
            <Field label="Person">
              <select className="field" value={userId} onChange={(e) => { setUserId(e.target.value); const c = candidates.find((x) => x.id === e.target.value); setRole(c?.side === "staff" ? (c.kind === "director" ? "director" : "team") : "client_stakeholder") }}>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.side === "staff" ? "Morphoverse" : "Client"}</option>)}
              </select>
            </Field>
            <Field label="Project role">
              <select className="field" value={role} onChange={(e) => setRole(e.target.value as ProjectRole)}>{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-xs font-medium">Workstreams</legend>
              {workstreams.map((w) => (
                <label key={w.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-[var(--brand)]" checked={ws.includes(w.id)} onChange={(e) => setWs(e.target.checked ? [...ws, w.id] : ws.filter((x) => x !== w.id))} />
                  {w.name}
                </label>
              ))}
            </fieldset>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending || !userId} onClick={() => run(() => addMember(projectId, userId, role, ws), () => { setOpen(false); setWs([]) })}>Add member</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AddWorkstreamButton({ projectId }: { projectId: string }) {
  return <ReasonDialog trigger="Add workstream" title="Add a workstream" description="Members of other workstreams cannot see its items." label="Workstream name" minLength={2} confirm="Add" onSubmit={(n) => addWorkstream(projectId, n)} />
}
