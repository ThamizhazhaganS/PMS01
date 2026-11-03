"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { adminSelfGrant, createOrganisation, inviteUser, setUserStatus } from "@/lib/actions"
import type { UserKind } from "@/lib/domain/types"
import { ROLE_LABEL } from "@/lib/domain/rules"
import { ActionButton } from "@/components/shared/dialogs"
import { Field } from "@/components/shared/ui"
import { useAction } from "@/components/shared/use-action"

const PRESET_HINT: Partial<Record<UserKind, string>> = {
  director: "Full project access on projects they own",
  team: "Collaborator — drafts only until a Director grants publish right",
  client_lead: "Approver preset — can be designated on approval requests",
  client_stakeholder: "Workstream contributor — sees only their workstream + Client-wide",
  exec: "Portfolio oversight across the organisation (no Team content)",
}

export function InviteDialog({ orgs, projects }: { orgs: { id: string; name: string; kind: string }[]; projects: { id: string; name: string; orgId: string; workstreams: { id: string; name: string }[] }[] }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: "", email: "", orgId: orgs[1]?.id ?? "", kind: "client_stakeholder" as UserKind, projectId: "", workstreamId: "" })
  const { pending, run } = useAction()
  const org = orgs.find((o) => o.id === f.orgId)
  const kinds: UserKind[] = org?.kind === "agency" ? ["director", "team"] : ["exec", "client_lead", "client_stakeholder"]
  const proj = projects.find((p) => p.id === f.projectId)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Invite user</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>Single-use invitation, expires in 7 days. Email is verified before any access is granted. Project membership is granted separately.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Full name"><input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Work email"><input type="email" className="field" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Organisation">
              <select className="field" value={f.orgId} onChange={(e) => { const o = orgs.find((x) => x.id === e.target.value); setF({ ...f, orgId: e.target.value, kind: o?.kind === "agency" ? "team" : "client_stakeholder", projectId: "" }) }}>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
            <Field label="Role preset">
              <select className="field" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as UserKind })}>
                {kinds.map((k) => <option key={k} value={k}>{ROLE_LABEL[k]}</option>)}
              </select>
            </Field>
          </div>
          <p className="rounded-md bg-muted p-2 text-xs">Effective access preview: {PRESET_HINT[f.kind]}</p>
          {f.kind !== "exec" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Add to project (optional)">
                <select className="field" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value, workstreamId: "" })}>
                  <option value="">None</option>
                  {projects.filter((p) => org?.kind === "agency" || p.orgId === f.orgId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              {proj && (
                <Field label="Workstream">
                  <select className="field" value={f.workstreamId} onChange={(e) => setF({ ...f, workstreamId: e.target.value })}>
                    <option value="">None</option>
                    {proj.workstreams.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </Field>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => run(() => inviteUser({ ...f, projectId: f.projectId || undefined, workstreamId: f.workstreamId || undefined }), () => setOpen(false))}>Send invitation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UserStatusButton({ id, status }: { id: string; status: string }) {
  if (status === "invited") return <span className="text-xs text-muted-foreground">Invitation pending</span>
  return status === "active" ? (
    <ActionButton size="xs" variant="destructive" onRun={() => setUserStatus(id, "deactivated")}>Deactivate</ActionButton>
  ) : (
    <ActionButton size="xs" onRun={() => setUserStatus(id, "active")}>Reactivate</ActionButton>
  )
}

export function SelfGrantButton({ projectId, granted }: { projectId: string; granted: boolean }) {
  if (granted) return <span className="text-xs text-bad">Self-granted (alerted)</span>
  return <ActionButton size="xs" variant="ghost" onRun={() => adminSelfGrant(projectId)}>Self-grant access…</ActionButton>
}

export function OrgDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const { pending, run } = useAction()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>New organisation</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New client organisation</DialogTitle>
          <DialogDescription>The code prefixes its project IDs, e.g. NOVA-2026-001.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Name"><input className="field" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Code (2–6 letters)"><input className="field uppercase" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/[^a-z]/gi, ""))} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => run(() => createOrganisation(name, code), () => { setOpen(false); setName(""); setCode("") })}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
