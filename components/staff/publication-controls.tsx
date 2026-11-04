"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { newDocumentVersion, publishDraftPublication, retractDocument, retractPublication, revisePublication, setDocumentAudience, uploadDocument } from "@/lib/actions"
import { FileText, Upload, X } from "lucide-react"
import type { Audience } from "@/lib/domain/types"
import type { Result } from "@/lib/actions"
import { cn } from "@/lib/utils"
import { ReasonDialog } from "@/components/shared/dialogs"
import { Field } from "@/components/shared/ui"
import { useAction } from "@/components/shared/use-action"
import { AudiencePicker, type PickerData, PublishDialog, Recipients } from "./audience-picker"

type DocKind = "deliverable" | "working" | "reference"
const KINDS: { k: DocKind; label: string; hint: string }[] = [
  { k: "deliverable", label: "Deliverable", hint: "Something we hand over" },
  { k: "working", label: "Working file", hint: "Work in progress" },
  { k: "reference", label: "Reference", hint: "Background material" },
]
const blocked = (name: string) => (/\.(exe|bat|cmd|js|scr)$/i.test(name) ? "This file type is not allowed" : null)

/** One step: drop files, say what they are and who can see them. */
export function UploadDialog({ projectId, data, canPublish }: { projectId: string; data: PickerData; canPublish: boolean }) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<{ name: string; title: string }[]>([])
  const [kind, setKind] = useState<DocKind>("deliverable")
  const [aud, setAud] = useState<Audience | null>({ kind: "draft" })
  const [checked, setChecked] = useState(false)
  const [over, setOver] = useState(false)
  const { pending, run } = useAction()
  const reset = () => {
    setFiles([])
    setKind("deliverable")
    setAud({ kind: "draft" })
    setChecked(false)
  }
  const add = (list: FileList | null) => {
    if (!list) return
    const picked = [...list].map((f) => ({ name: f.name, title: f.name.replace(/\.[^.]+$/, "") }))
    setFiles((cur) => [...cur, ...picked.filter((p) => !cur.some((c) => c.name === p.name))])
  }
  const sharing = !!aud && aud.kind !== "draft"
  const ready = files.length > 0 && files.every((f) => f.title.trim() && !blocked(f.name)) && (!sharing || checked)
  // Each file is uploaded as a Draft, then shared through the same checked step as "Publish…".
  const upload = async (): Promise<Result> => {
    for (const f of files) {
      const r = await uploadDocument(projectId, { title: f.title, fileName: f.name, kind })
      if (!r.ok) return { ok: false, error: `${f.name}: ${r.error}` }
      if (sharing && r.id) {
        const shared = await setDocumentAudience(projectId, r.id, aud!, true)
        if (!shared.ok) return { ok: false, error: `${f.name} was saved as a Draft but not shared: ${shared.error}` }
      }
    }
    const n = files.length
    return { ok: true, message: `${n} file${n > 1 ? "s" : ""} uploaded${sharing ? " and shared" : " as a private Draft"}.` }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Upload /> Upload files
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>Every file is checked for viruses before it is saved.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              add(e.dataTransfer.files)
            }}
            className={cn("flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-6 text-center transition hover:border-foreground/30", over && "border-brand bg-brand-soft/40")}
          >
            <Upload className="size-5 text-muted-foreground" />
            <span className="text-sm font-medium">Drag files here, or click to choose</span>
            <span className="text-xs text-muted-foreground">PDF, Word, Excel, PowerPoint and images</span>
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                add(e.target.files)
                e.target.value = ""
              }}
            />
          </label>

          {files.length > 0 && (
            <ul className="grid gap-2">
              {files.map((f, i) => (
                <li key={f.name} className="rounded-lg border p-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <input aria-label={`Title for ${f.name}`} className="field h-8 flex-1" value={f.title} onChange={(e) => setFiles(files.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                      <X />
                    </Button>
                  </div>
                  <p className={cn("mt-1 truncate pl-6 text-xs", blocked(f.name) ? "text-bad" : "text-muted-foreground")}>
                    {f.name}
                    {blocked(f.name) && ` · ${blocked(f.name)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div>
            <p className="mb-2 text-xs font-medium">What is it?</p>
            <div role="radiogroup" aria-label="File type" className="grid grid-cols-3 gap-2">
              {KINDS.map((o) => (
                <button key={o.k} type="button" role="radio" aria-checked={kind === o.k} onClick={() => setKind(o.k)} className={cn("rounded-lg border p-2 text-left transition hover:border-foreground/30", kind === o.k && "border-brand bg-brand-soft/60 ring-1 ring-brand")}>
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{o.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <p className="text-xs font-medium">Who can see it?</p>
            <AudiencePicker
              data={data}
              value={aud}
              allowDraft
              onChange={(a) => {
                setAud(a)
                setChecked(false)
              }}
            />
            {sharing && (
              <>
                <Recipients data={data} audience={aud} />
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1 accent-[var(--brand)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                  I have checked who will see this.
                </label>
              </>
            )}
            {!canPublish && <p className="text-xs text-muted-foreground">You can keep files as a Draft or share them with the Morphoverse team. Sharing with the client needs permission from the CEO.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={pending || !ready}
            onClick={() =>
              run(upload, () => {
                setOpen(false)
                reset()
              })
            }
          >
            {files.length > 1 ? `Upload ${files.length} files` : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DocumentActions({ projectId, doc, data, canPublish, isDirector }: { projectId: string; doc: { id: string; title: string; audience: Audience; retracted: boolean }; data: PickerData; canPublish: boolean; isDirector: boolean }) {
  if (doc.retracted) return null
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <NewVersionDialog projectId={projectId} docId={doc.id} />
      {canPublish ? (
        <PublishDialog data={data} title={doc.title} current={doc.audience} trigger={doc.audience.kind === "draft" ? "Publish…" : "Audience…"} onPublish={(a, ok) => setDocumentAudience(projectId, doc.id, a, ok)} />
      ) : (
        doc.audience.kind === "draft" && (
          <PublishDialog
            data={{ ...data, workstreams: [] }}
            title={doc.title}
            trigger="Share with team…"
            onPublish={(a, ok) => setDocumentAudience(projectId, doc.id, a, ok)}
          />
        )
      )}
      {isDirector && doc.audience.kind !== "draft" && (
        <ReasonDialog trigger="Retract" variant="ghost" size="xs" confirmVariant="destructive" title={`Retract “${doc.title}”`} description="Content is hidden from its audience and downloads stop. A notice and the full history remain." confirm="Retract" onSubmit={(r) => retractDocument(projectId, doc.id, r)} />
      )}
    </div>
  )
}

function NewVersionDialog({ projectId, docId }: { projectId: string; docId: string }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState("")
  const [note, setNote] = useState("")
  const { pending, run } = useAction()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="xs" variant="ghost" />}>New version</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a new version</DialogTitle>
          <DialogDescription>Earlier versions stay viewable. The change note is shown to the audience. Pending approvals on older versions become Superseded.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="File"><input type="file" className="field pt-1.5" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} /></Field>
          <Field label="What changed?" hint="Required"><textarea className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending || !file} onClick={() => run(() => newDocumentVersion(projectId, docId, file, note), () => { setOpen(false); setNote("") })}>Add version</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PublicationActions({ projectId, pub, data, canPublish, isDirector }: { projectId: string; pub: { id: string; title: string; summary: string; state: "draft" | "published"; superseded: boolean; retracted: boolean }; data: PickerData; canPublish: boolean; isDirector: boolean }) {
  if (pub.retracted || pub.superseded) return null
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {pub.state === "draft" && canPublish && <PublishDialog data={data} title={pub.title} onPublish={(a, ok) => publishDraftPublication(projectId, pub.id, a, ok)} />}
      {pub.state === "published" && canPublish && <ReviseDialog projectId={projectId} id={pub.id} summary={pub.summary} />}
      {pub.state === "published" && isDirector && (
        <ReasonDialog trigger="Retract" variant="ghost" size="xs" confirmVariant="destructive" title={`Retract “${pub.title}”`} description="Published records cannot be deleted. Retraction hides content and leaves a notice." confirm="Retract" onSubmit={(r) => retractPublication(projectId, pub.id, r)} />
      )}
    </div>
  )
}

function ReviseDialog({ projectId, id, summary }: { projectId: string; id: string; summary: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(summary)
  const [note, setNote] = useState("")
  const { pending, run } = useAction()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="xs" variant="outline" />}>Publish revision</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish a revised record</DialogTitle>
          <DialogDescription>Published records are immutable. This creates a new version that supersedes the current one; both stay in history.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Corrected summary"><textarea className="field" rows={5} value={text} onChange={(e) => setText(e.target.value)} /></Field>
          <Field label="Change note (visible to recipients)"><input className="field" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => run(() => revisePublication(projectId, id, text, note), () => setOpen(false))}>Publish revision</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
