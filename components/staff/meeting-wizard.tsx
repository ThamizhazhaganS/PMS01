"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Lock, Paperclip, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { savePublication, type PublicationInput } from "@/lib/actions"
import type { Audience, Publication } from "@/lib/domain/types"
import { ROLE_LABEL, fmtDateTime, isStaffKind } from "@/lib/domain/rules"
import { Field } from "@/components/shared/ui"
import { useAction } from "@/components/shared/use-action"
import { cn } from "@/lib/utils"
import { AudiencePicker, type PickerData, Recipients } from "./audience-picker"

const STEPS = ["Details", "Attendees", "Notes", "Team remarks", "Files", "Audience & preview"]

type FileAud = "none" | "same" | "team" | "client" | `ws:${string}`

export function MeetingWizard({ data, docs, canPublish }: { data: PickerData; docs: { id: string; title: string; version: number; audience: string }[]; canPublish: boolean }) {
  const [step, setStep] = useState(0)
  const [kind, setKind] = useState<Publication["kind"]>("meeting")
  const [title, setTitle] = useState("")
  const [meetingAt, setMeetingAt] = useState("")
  const [actionRequired, setActionRequired] = useState(false)
  const [attendees, setAttendees] = useState<string[]>([data.authorId])
  const [summary, setSummary] = useState("")
  const [decisions, setDecisions] = useState<string[]>([""])
  const [actions, setActions] = useState<{ description: string; ownerId: string; due?: string }[]>([])
  const [remarks, setRemarks] = useState("")
  const [attach, setAttach] = useState<Record<string, FileAud>>({})
  const [newFiles, setNewFiles] = useState<{ title: string; fileName: string; aud: FileAud }[]>([])
  const [audience, setAudience] = useState<Audience | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const { pending, run } = useAction()
  const router = useRouter()
  const nameOf = (id: string) => data.people.find((p) => p.user.id === id)?.user.name ?? id

  const resolve = (a: FileAud): Audience | null => {
    if (a === "none") return null
    if (a === "same") return audience
    if (a === "team" || a === "client") return { kind: a }
    return { kind: "workstream", workstreamId: a.slice(3) }
  }
  const fileOptions = (
    <>
      <option value="none">Not shared (stays as is)</option>
      <option value="same">Same audience as record</option>
      <option value="team">Team only</option>
      {data.workstreams.map((w) => <option key={w.id} value={`ws:${w.id}`}>Workstream · {w.name}</option>)}
      <option value="client">Client-wide</option>
    </>
  )

  const payload = (): PublicationInput => ({
    kind, title, meetingAt: meetingAt || undefined, summary, attendeeIds: attendees,
    decisions, actions, teamRemarks: remarks,
    attachments: Object.entries(attach).map(([documentId, a]) => ({ documentId, audience: resolve(a) })),
    newFiles: newFiles.map((f) => ({ title: f.title, fileName: f.fileName, audience: resolve(f.aud) })),
    audience, actionRequired,
  })
  const submit = (publish: boolean) =>
    run(() => savePublication(data.project.id, payload(), publish, confirmed), () => router.push(`/w/projects/${data.project.id}/publications`))

  const sharedFiles = [
    ...Object.entries(attach).filter(([, a]) => a !== "none").map(([id, a]) => ({ name: docs.find((d) => d.id === id)?.title ?? id, aud: resolve(a) })),
    ...newFiles.filter((f) => f.aud !== "none").map((f) => ({ name: f.title || f.fileName, aud: resolve(f.aud) })),
  ]
  const clientVisibleFiles = sharedFiles.filter((f) => f.aud && f.aud.kind !== "team")

  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
      <ol className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              onClick={() => setStep(i)}
              aria-current={step === i ? "step" : undefined}
              className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition hover:bg-muted", step === i && "bg-muted font-medium")}
            >
              <span className={cn("flex size-5 items-center justify-center rounded-full border font-mono text-[10px]", i < step && "border-ok bg-ok text-white", step === i && "border-foreground")}>
                {i < step ? <Check className="size-3" /> : i + 1}
              </span>
              {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="rounded-xl border bg-card p-5">
        {step === 0 && (
          <div className="grid gap-4">
            <Field label="Type" as="div">
              <div className="flex flex-wrap gap-2">
                {(["meeting", "update", "deliverable"] as const).map((k) => (
                  <button key={k} onClick={() => setKind(k)} className={cn("rounded-lg border px-3 py-1.5 text-sm capitalize", kind === k && "border-brand bg-brand-soft/60 ring-1 ring-brand")}>{k}</button>
                ))}
              </div>
            </Field>
            <Field label="Title"><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Steering Committee #3" /></Field>
            {kind === "meeting" && (
              <Field label="When did the meeting happen? (IST)" hint="Records sort by this date, not upload time.">
                <input type="datetime-local" className="field" value={meetingAt} onChange={(e) => setMeetingAt(e.target.value)} />
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--brand)]" checked={actionRequired} onChange={(e) => setActionRequired(e.target.checked)} /> Action required from recipients (sends an urgent notice)</label>
          </div>
        )}

        {step === 1 && (
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Who attended?</legend>
            {data.people.map((p) => (
              <label key={p.user.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-[var(--brand)]" checked={attendees.includes(p.user.id)} onChange={(e) => setAttendees(e.target.checked ? [...attendees, p.user.id] : attendees.filter((x) => x !== p.user.id))} />
                {p.user.name} <span className="text-xs text-muted-foreground">· {isStaffKind(p.user.kind) ? "Morphoverse" : "Nova"} · {ROLE_LABEL[p.user.kind]}</span>
              </label>
            ))}
          </fieldset>
        )}

        {step === 2 && (
          <div className="grid gap-5">
            <Field label="Summary (client-visible)"><textarea className="field" rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} /></Field>
            <div>
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium">Decisions (go to the decision register)</span><Button size="xs" variant="outline" onClick={() => setDecisions([...decisions, ""])}><Plus /> Add</Button></div>
              <div className="grid gap-2">
                {decisions.map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <input aria-label={`Decision ${i + 1}`} className="field" placeholder="One-line decision" value={d} onChange={(e) => setDecisions(decisions.map((x, j) => (j === i ? e.target.value : x)))} />
                    <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setDecisions(decisions.filter((_, j) => j !== i))}><Trash2 /></Button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium">Next steps / actions (go to owners&apos; lists)</span><Button size="xs" variant="outline" onClick={() => setActions([...actions, { description: "", ownerId: data.people[0]?.user.id ?? "" }])}><Plus /> Add</Button></div>
              <div className="grid gap-2">
                {actions.map((a, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_10rem_9rem_auto]">
                    <input aria-label="Action" className="field" placeholder="Action" value={a.description} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                    <select aria-label="Owner" className="field" value={a.ownerId} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, ownerId: e.target.value } : x)))}>
                      {data.people.map((p) => <option key={p.user.id} value={p.user.id}>{p.user.name}</option>)}
                    </select>
                    <input aria-label="Due" type="date" className="field" value={a.due ?? ""} onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} />
                    <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setActions(actions.filter((_, j) => j !== i))}><Trash2 /></Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="rounded-lg border border-dashed border-warn/50 bg-warn-soft/40 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-warn"><Lock className="size-4" /> Team remarks — Morphoverse only</p>
            <p className="mt-1 text-xs text-muted-foreground">Stored separately. Never shown in client views, search, notifications or exports.</p>
            <textarea aria-label="Team remarks" className="field mt-3" rows={5} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-5">
            <p className="text-sm text-muted-foreground">Attachments don&apos;t publish automatically. Give each file its own audience.</p>
            <div>
              <div className="mb-2 text-xs font-medium">Existing documents</div>
              <ul className="divide-y rounded-lg border">
                {docs.map((d) => (
                  <li key={d.id} className="grid gap-2 p-2.5 sm:grid-cols-[1fr_15rem] sm:items-center">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="accent-[var(--brand)]" checked={d.id in attach} onChange={(e) => { const n = { ...attach }; if (e.target.checked) n[d.id] = "none"; else delete n[d.id]; setAttach(n) }} />
                      <Paperclip className="size-3.5 text-muted-foreground" /> {d.title} <span className="text-xs text-muted-foreground">v{d.version} · now {d.audience}</span>
                    </label>
                    {d.id in attach && <select aria-label={`Audience for ${d.title}`} className="field h-8 text-xs" value={attach[d.id]} onChange={(e) => setAttach({ ...attach, [d.id]: e.target.value as FileAud })}>{fileOptions}</select>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium">Upload new files</span></div>
              <input type="file" multiple className="field pt-1.5" onChange={(e) => { const fs = Array.from(e.target.files ?? []); setNewFiles([...newFiles, ...fs.map((f) => ({ title: f.name.replace(/\.[^.]+$/, ""), fileName: f.name, aud: "none" as FileAud }))]); e.target.value = "" }} />
              <ul className="mt-2 grid gap-2">
                {newFiles.map((f, i) => (
                  <li key={i} className="grid gap-2 rounded-lg border p-2.5 sm:grid-cols-[1fr_15rem_auto] sm:items-center">
                    <span className="truncate text-sm">{f.fileName}</span>
                    <select aria-label={`Audience for ${f.fileName}`} className="field h-8 text-xs" value={f.aud} onChange={(e) => setNewFiles(newFiles.map((x, j) => (j === i ? { ...x, aud: e.target.value as FileAud } : x)))}>{fileOptions}</select>
                    <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => setNewFiles(newFiles.filter((_, j) => j !== i))}><Trash2 /></Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="grid content-start gap-4">
              <div>
                <div className="mb-2 text-xs font-medium">Audience for the record (no default)</div>
                <AudiencePicker data={data} value={audience} onChange={(a) => { setAudience(a); setConfirmed(false) }} />
              </div>
              <Recipients data={data} audience={audience} />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 accent-[var(--brand)]" disabled={!audience} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                I have checked who will receive this and the preview.
              </label>
            </div>
            <div>
              <div className="eyebrow mb-2">Preview — what client recipients see</div>
              <article className="rounded-xl border bg-background p-4 text-sm shadow-xs">
                <div className="text-xs text-muted-foreground">{kind} · {meetingAt ? fmtDateTime(new Date(`${meetingAt}:00+05:30`).toISOString()) : "no date"}</div>
                <h3 className="mt-1 text-base font-semibold">{title || "Untitled"}</h3>
                <p className="mt-2 whitespace-pre-line">{summary || <span className="text-muted-foreground">No summary</span>}</p>
                {attendees.length > 0 && kind === "meeting" && <p className="mt-2 text-xs text-muted-foreground">Attendees: {attendees.map(nameOf).join(", ")}</p>}
                {decisions.some((d) => d.trim()) && <div className="mt-3"><div className="eyebrow mb-1">Decisions</div><ul className="list-inside list-disc">{decisions.filter((d) => d.trim()).map((d, i) => <li key={i}>{d}</li>)}</ul></div>}
                {actions.some((a) => a.description.trim()) && <div className="mt-3"><div className="eyebrow mb-1">Next steps</div><ul className="list-inside list-disc">{actions.filter((a) => a.description.trim()).map((a, i) => <li key={i}>{a.description} — {nameOf(a.ownerId)}</li>)}</ul></div>}
                <div className="mt-3"><div className="eyebrow mb-1">Files</div>{clientVisibleFiles.length ? <ul>{clientVisibleFiles.map((f, i) => <li key={i} className="flex items-center gap-1"><Paperclip className="size-3" /> {f.name}</li>)}</ul> : <p className="text-xs text-muted-foreground">No files shared with clients</p>}</div>
                <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">Team remarks are not included.</p>
              </article>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={pending} onClick={() => submit(false)}>Save as Draft</Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>Next</Button>
            ) : (
              <Button disabled={pending || !canPublish || !audience || !confirmed} onClick={() => submit(true)} title={canPublish ? undefined : "You need the publish right"}>
                Publish
              </Button>
            )}
          </div>
        </div>
        {!canPublish && step === STEPS.length - 1 && <p className="mt-2 text-right text-xs text-warn">You don&apos;t have the publish right. Save as Draft and a Director can publish it.</p>}
      </div>
    </div>
  )
}
