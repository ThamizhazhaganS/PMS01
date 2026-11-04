"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { type MemberLite, recipientsFor } from "@/lib/access/audience"
import type { Audience, Project } from "@/lib/domain/types"
import type { Result } from "@/lib/actions"
import { ROLE_LABEL, isStaffKind } from "@/lib/domain/rules"
import { useAction } from "@/components/shared/use-action"
import { cn } from "@/lib/utils"

export interface PickerData {
  project: Project
  people: MemberLite[]
  workstreams: { id: string; name: string }[]
  authorId: string
}

type Kind = Audience["kind"]

export function AudiencePicker({ data, value, onChange, allowDraft, allowNone }: { data: PickerData; value: Audience | null; onChange: (a: Audience | null) => void; allowDraft?: boolean; allowNone?: string }) {
  const [named, setNamed] = useState<string[]>(value?.kind === "named" ? value.userIds : [])
  const kinds: { k: Kind | "none"; label: string; hint: string }[] = [
    ...(allowNone ? [{ k: "none" as const, label: allowNone, hint: "Stays private" }] : []),
    ...(allowDraft ? [{ k: "draft" as const, label: "Draft", hint: "Only you, for now" }] : []),
    { k: "team", label: "Morphoverse team", hint: "Our people only" },
    { k: "workstream", label: "Workstream", hint: "People in one workstream" },
    { k: "named", label: "Named people", hint: "Only the people you tick" },
    { k: "client", label: "Everyone", hint: "Including the client" },
  ]
  const current: Kind | "none" = value ? value.kind : "none"
  const pick = (k: Kind | "none") => {
    if (k === "none") onChange(null)
    else if (k === "workstream") onChange({ kind: "workstream", workstreamId: data.workstreams[0]?.id ?? "" })
    else if (k === "named") onChange({ kind: "named", userIds: named.length ? named : [data.authorId] })
    else onChange({ kind: k } as Audience)
  }
  return (
    <div className="grid gap-2">
      <div role="radiogroup" aria-label="Who can see it" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {kinds.map((o) => (
          <button
            key={o.k}
            type="button"
            role="radio"
            aria-checked={current === o.k}
            onClick={() => pick(o.k)}
            className={cn("rounded-lg border p-2 text-left transition hover:border-foreground/30", current === o.k && "border-brand bg-brand-soft/60 ring-1 ring-brand")}
          >
            <span className="block text-sm font-medium">{o.label}</span>
            <span className="block text-[11px] text-muted-foreground">{o.hint}</span>
          </button>
        ))}
      </div>
      {value?.kind === "workstream" && (
        <select aria-label="Workstream" className="field" value={value.workstreamId} onChange={(e) => onChange({ kind: "workstream", workstreamId: e.target.value })}>
          {data.workstreams.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      )}
      {value?.kind === "named" && (
        <fieldset className="grid max-h-40 gap-1 overflow-y-auto rounded-lg border p-2">
          <legend className="px-1 text-xs font-medium">Listed people</legend>
          {data.people.map((p) => (
            <label key={p.user.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[var(--brand)]"
                checked={value.userIds.includes(p.user.id)}
                onChange={(e) => {
                  const ids = e.target.checked ? [...value.userIds, p.user.id] : value.userIds.filter((x) => x !== p.user.id)
                  setNamed(ids)
                  onChange({ kind: "named", userIds: ids })
                }}
              />
              {p.user.name} <span className="text-xs text-muted-foreground">· {ROLE_LABEL[p.user.kind]}</span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  )
}

/** Live recipient list for a chosen audience (REQ-PUB-01). Exec oversight is included for client audiences. */
export function Recipients({ data, audience }: { data: PickerData; audience: Audience | null }) {
  if (!audience) return <p className="text-xs text-muted-foreground">No audience chosen — nobody else will see it.</p>
  const list = recipientsFor(data.project, audience, data.authorId, data.people)
  const clients = list.filter((p) => !isStaffKind(p.user.kind))
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium">Who will see this ({list.length})</span>
        <span className={clients.length ? "text-warn" : "text-muted-foreground"}>{clients.length ? `${clients.length} client user(s)` : "No client users"}</span>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {list.map((p) => (
          <li key={p.user.id} className={cn("rounded-full px-2 py-0.5 text-xs ring-1 ring-inset", isStaffKind(p.user.kind) ? "bg-muted ring-border" : "bg-info-soft text-info ring-info/20")}>
            {p.user.name}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Deliberate publish: choose audience → see recipients → confirm. No default audience. */
export function PublishDialog({ data, title, trigger = "Publish…", current, onPublish }: { data: PickerData; title: string; trigger?: string; current?: Audience; onPublish: (a: Audience, confirmed: boolean) => Promise<Result> }) {
  const [open, setOpen] = useState(false)
  const [aud, setAud] = useState<Audience | null>(null)
  const [ok, setOk] = useState(false)
  const { pending, run } = useAction()
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setAud(null); setOk(false) } }}>
      <DialogTrigger render={<Button size="xs" variant="outline" />}>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish “{title}”</DialogTitle>
          <DialogDescription>
            Choose who can see this. Widening an audience is deliberate and logged.{current ? ` Currently: ${current.kind}.` : ""}
          </DialogDescription>
        </DialogHeader>
        <AudiencePicker data={data} value={aud} onChange={(a) => { setAud(a); setOk(false) }} />
        <Recipients data={data} audience={aud} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 accent-[var(--brand)]" checked={ok} disabled={!aud} onChange={(e) => setOk(e.target.checked)} />
          I have checked the recipient list.
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!aud || !ok || pending} onClick={() => run(() => onPublish(aud!, ok), () => setOpen(false))}>Publish</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
