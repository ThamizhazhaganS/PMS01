"use client"

import { useState } from "react"
import { FileText, Paperclip, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { type EstimateFields, addEstimateFile, removeEstimateFile, updateEstimate } from "@/lib/actions"
import type { Estimate } from "@/lib/domain/types"
import { Field } from "@/components/shared/ui"
import { useAction } from "@/components/shared/use-action"
import { EstimateFieldsForm } from "./estimate-fields"

const orBlank = (xs: string[]) => (xs.length ? xs : [""])

export function EstimateEditor({ projectId, e }: { projectId: string; e: Estimate }) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState(e.scope)
  const [f, setF] = useState<EstimateFields>({
    lineItems: e.lineItems,
    effortDays: e.effortDays,
    durationWeeks: e.durationWeeks,
    expenses: e.expenses,
    taxRate: e.taxRate,
    deliverables: orBlank(e.deliverables),
    assumptions: orBlank(e.assumptions),
    exclusions: orBlank(e.exclusions),
    detailLevel: e.detailLevel,
    validUntil: e.validUntil,
    costPerDay: e.internal.costPerDay,
    targetMarginPct: e.internal.targetMarginPct,
    internalNotes: e.internal.notes,
  })
  const { pending, run } = useAction()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Edit draft</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit estimate v{e.version} (draft)</DialogTitle>
          <DialogDescription>Drafts are editable. Once shared, a version is locked forever.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <Field label="Scope"><textarea className="field" rows={2} value={scope} onChange={(ev) => setScope(ev.target.value)} /></Field>
          <EstimateFieldsForm value={f} onChange={setF} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => run(() => updateEstimate(projectId, e.id, { ...f, scope }), () => setOpen(false))}>Save draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Supporting files for an estimate (rate card, pricing rationale…).
 * Editable while the version is a draft; the client sees them once it is shared.
 */
export function EstimateFilesPanel({ projectId, estimateId, files, editable }: { projectId: string; estimateId: string; files: { id: string; title: string; fileName: string; sizeKb: number }[]; editable: boolean }) {
  const { pending, run } = useAction()
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="eyebrow flex items-center gap-1.5"><Paperclip className="size-3" /> Supporting files</h4>
        {editable && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted">
            <Paperclip className="size-3.5" /> Attach file
            <input
              type="file"
              className="sr-only"
              disabled={pending}
              onChange={(ev) => {
                const name = ev.target.files?.[0]?.name
                ev.target.value = ""
                if (name) run(() => addEstimateFile(projectId, estimateId, name))
              }}
            />
          </label>
        )}
      </div>
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">{editable ? "Attach the rate card, pricing rationale or proposal so the client can see how the estimate was built." : "No supporting files."}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-2 p-2.5 text-sm">
              <a href={`/api/files/${file.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.fileName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{file.sizeKb.toLocaleString("en-IN")} KB</span>
              </a>
              {editable && (
                <Button size="icon-sm" variant="ghost" aria-label={`Remove ${file.fileName}`} disabled={pending} onClick={() => run(() => removeEstimateFile(projectId, estimateId, file.id))}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
