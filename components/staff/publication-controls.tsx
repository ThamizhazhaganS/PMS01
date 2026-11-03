"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { newDocumentVersion, publishDraftPublication, retractDocument, retractPublication, revisePublication, setDocumentAudience, uploadDocument } from "@/lib/actions"
import type { Audience } from "@/lib/domain/types"
import { ReasonDialog } from "@/components/shared/dialogs"
import { Field } from "@/components/shared/ui"
import { useAction } from "@/components/shared/use-action"
import { type PickerData, PublishDialog } from "./audience-picker"

export function UploadDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [file, setFile] = useState("")
  const [kind, setKind] = useState<"deliverable" | "working" | "reference">("deliverable")
  const { pending, run } = useAction()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Upload document</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
          <DialogDescription>Uploads start as a private Draft (only you). Type and malware checks run first. Dev: a file name containing “eicar” is quarantined.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Title"><input className="field" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="File">
            <input type="file" className="field pt-1.5" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f.name); if (!title) setTitle(f.name.replace(/\.[^.]+$/, "")) } }} />
          </Field>
          <Field label="Kind">
            <select className="field" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="deliverable">Deliverable</option>
              <option value="working">Working document</option>
              <option value="reference">Reference</option>
            </select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending || !file} onClick={() => run(() => uploadDocument(projectId, { title, fileName: file, kind }), () => { setOpen(false); setTitle(""); setFile("") })}>Upload as Draft</Button>
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
        <ReasonDialog trigger="Retract" variant="ghost" size="xs" confirmVariant="destructive" title={`Retract “${pub.title}”`} description="Published records can't be deleted. Retraction hides content and leaves a notice." confirm="Retract" onSubmit={(r) => retractPublication(projectId, pub.id, r)} />
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
