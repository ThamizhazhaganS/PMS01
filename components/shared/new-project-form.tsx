"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createProject } from "@/lib/actions"
import { DEFAULT_PHASES } from "@/lib/domain/rules"
import { Field } from "./ui"
import { useAction } from "./use-action"

type Opt = { id: string; name: string; detail?: string }

/** REQ-PRJ-01: captures everything needed to start in Setup with the default 8 phases. */
export function NewProjectForm({ orgs, directors, staff, clients, ownerFixed, done }: { orgs: { id: string; name: string; code: string }[]; directors: Opt[]; staff: Opt[]; clients: (Opt & { orgId: string })[]; ownerFixed?: string; done: string }) {
  const [f, setF] = useState({ name: "", clientOrgId: orgs[0]?.id ?? "", ownerId: ownerFixed ?? directors[0]?.id ?? "", objectives: "", scope: "", plannedStart: "", targetEnd: "", clientLeadId: "" })
  const [ws, setWs] = useState<string[]>([""])
  const [team, setTeam] = useState<string[]>([])
  const { pending, run } = useAction()
  const router = useRouter()
  const org = orgs.find((o) => o.id === f.clientOrgId)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  const [createdId, setCreatedId] = useState<string | null>(null)
  // Navigate once the action has settled, so it doesn't race the action's own refresh.
  useEffect(() => {
    if (createdId) router.push(done.replace(":id", createdId))
  }, [createdId, done, router])

  const submit = () =>
    run(async () => {
      const r = await createProject({ ...f, workstreams: ws, teamIds: team, clientLeadId: f.clientLeadId || undefined })
      if (r.ok && r.id) setCreatedId(r.id)
      return r
    })

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="grid gap-5 rounded-xl border bg-card p-5">
        <Field label="Project name"><input className="field" value={f.name} onChange={set("name")} placeholder="e.g. Finance Shared Services Assessment" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client organisation">
            <select className="field" value={f.clientOrgId} onChange={(e) => setF({ ...f, clientOrgId: e.target.value, clientLeadId: "" })}>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Owner (CEO)" hint={ownerFixed ? "You own projects you create." : "A project owner is always a Morphoverse CEO."}>
            <select className="field" value={f.ownerId} disabled={!!ownerFixed} onChange={set("ownerId")}>
              {directors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Objectives"><textarea className="field" rows={2} value={f.objectives} onChange={set("objectives")} /></Field>
        <Field label="Scope summary"><textarea className="field" rows={2} value={f.scope} onChange={set("scope")} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Planned start"><input type="date" className="field" value={f.plannedStart} onChange={set("plannedStart")} /></Field>
          <Field label="Target end"><input type="date" className="field" value={f.targetEnd} onChange={set("targetEnd")} /></Field>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium">Workstreams (at least one)</span>
            <Button size="xs" variant="outline" onClick={() => setWs([...ws, ""])}><Plus /> Add</Button>
          </div>
          <div className="grid gap-2">
            {ws.map((w, i) => (
              <div key={i} className="flex gap-2">
                <input aria-label={`Workstream ${i + 1}`} className="field" value={w} placeholder="e.g. Finance" onChange={(e) => setWs(ws.map((x, j) => (j === i ? e.target.value : x)))} />
                {ws.length > 1 && <Button size="icon" variant="ghost" aria-label="Remove workstream" onClick={() => setWs(ws.filter((_, j) => j !== i))}><Trash2 /></Button>}
              </div>
            ))}
          </div>
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-medium">Morphoverse team</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {staff.filter((s) => s.id !== f.ownerId).map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-[var(--brand)]" checked={team.includes(s.id)} onChange={(e) => setTeam(e.target.checked ? [...team, s.id] : team.filter((x) => x !== s.id))} />
                {s.name} <span className="text-xs text-muted-foreground">{s.detail}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Client Lead (optional now)" hint="Clients see nothing while the project is in Setup.">
          <select className="field" value={f.clientLeadId} onChange={set("clientLeadId")}>
            <option value="">Add later</option>
            {clients.filter((c) => c.orgId === f.clientOrgId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end">
          <Button disabled={pending} onClick={submit}>Create project</Button>
        </div>
      </div>
      <aside className="space-y-3 text-sm">
        <div className="rounded-xl border bg-card p-4">
          <div className="eyebrow mb-1">Project ID</div>
          <p className="font-mono">{org ? `${org.code}-${(f.plannedStart || new Date().toISOString()).slice(0, 4)}-###` : "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Generated on create · IST · INR</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="eyebrow mb-2">Starts in Setup with 8 phases</div>
          <ol className="space-y-1 text-xs text-muted-foreground">
            {DEFAULT_PHASES.map((p, i) => <li key={p}><span className="font-mono">{String(i + 1).padStart(2, "0")}</span> {p}</li>)}
          </ol>
        </div>
        <p className="text-xs text-muted-foreground">Next: add milestones on Plan, draft the estimate on Commercial, invite the Client Lead, then share the estimate to move to Proposal.</p>
      </aside>
    </div>
  )
}
