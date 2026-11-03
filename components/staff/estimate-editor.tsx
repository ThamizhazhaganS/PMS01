"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { updateEstimate } from "@/lib/actions"
import type { Estimate, LineItem } from "@/lib/domain/types"
import { estimateTotals, fmtINR } from "@/lib/domain/rules"
import { Field } from "@/components/shared/ui"
import { useAction } from "@/components/shared/use-action"

export function EstimateEditor({ projectId, e }: { projectId: string; e: Estimate }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({
    scope: e.scope,
    effortDays: e.effortDays,
    durationWeeks: e.durationWeeks,
    expenses: e.expenses,
    taxRate: e.taxRate,
    detailLevel: e.detailLevel,
    validUntil: e.validUntil,
    internalNotes: e.internal.notes,
    costPerDay: e.internal.costPerDay,
    targetMarginPct: e.internal.targetMarginPct,
  })
  const [items, setItems] = useState<LineItem[]>(e.lineItems)
  const { pending, run } = useAction()
  const t = estimateTotals({ lineItems: items, expenses: f.expenses, taxRate: f.taxRate })
  const num = (k: keyof typeof f) => (ev: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(ev.target.value) || 0 })
  const setItem = (i: number, patch: Partial<LineItem>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const margin = t.fees ? Math.round(((t.fees - items.reduce((s, x) => s + x.qty, 0) * f.costPerDay) / t.fees) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Edit draft</DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit estimate v{e.version} (draft)</DialogTitle>
          <DialogDescription>Drafts are editable. Once shared, a version is locked forever.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Scope"><textarea className="field" rows={2} value={f.scope} onChange={(ev) => setF({ ...f, scope: ev.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Effort (person-days)"><input type="number" className="field" value={f.effortDays} onChange={num("effortDays")} /></Field>
            <Field label="Duration (weeks)"><input type="number" className="field" value={f.durationWeeks} onChange={num("durationWeeks")} /></Field>
            <Field label="Expenses (₹)"><input type="number" className="field" value={f.expenses} onChange={num("expenses")} /></Field>
            <Field label="Tax (%)"><input type="number" className="field" value={f.taxRate} onChange={num("taxRate")} /></Field>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium">Line items</span>
              <Button size="xs" variant="outline" onClick={() => setItems([...items, { id: `li-${Date.now()}`, label: "", qty: 1, unit: "days", rate: 0 }])}><Plus /> Add line</Button>
            </div>
            <div className="space-y-2">
              {items.map((li, i) => (
                <div key={li.id} className="grid grid-cols-[1fr_5rem_7rem_auto] gap-2">
                  <input aria-label="Line item" className="field" placeholder="Role or item" value={li.label} onChange={(ev) => setItem(i, { label: ev.target.value })} />
                  <input aria-label="Quantity" type="number" className="field" value={li.qty} onChange={(ev) => setItem(i, { qty: Number(ev.target.value) || 0 })} />
                  <input aria-label="Rate" type="number" className="field" value={li.rate} onChange={(ev) => setItem(i, { rate: Number(ev.target.value) || 0 })} />
                  <Button size="icon" variant="ghost" aria-label="Remove line" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 /></Button>
                </div>
              ))}
            </div>
            <p className="mt-2 text-right text-sm">Total incl. tax <b className="tabular-nums">{fmtINR(t.total)}</b></p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Client-visible detail">
              <select className="field" value={f.detailLevel} onChange={(ev) => setF({ ...f, detailLevel: ev.target.value as "line_items" | "total" })}>
                <option value="line_items">Line items + total</option>
                <option value="total">Total only</option>
              </select>
            </Field>
            <Field label="Valid until"><input type="date" className="field" value={f.validUntil} onChange={(ev) => setF({ ...f, validUntil: ev.target.value })} /></Field>
          </div>
          <fieldset className="rounded-lg border border-dashed border-warn/50 bg-warn-soft/40 p-3">
            <legend className="px-1 text-xs font-semibold text-warn">Internal cost assumptions — never shown to clients</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Internal cost per day (₹)"><input type="number" className="field" value={f.costPerDay} onChange={num("costPerDay")} /></Field>
              <Field label="Target margin (%)" hint={`Implied margin: ${margin}%`}><input type="number" className="field" value={f.targetMarginPct} onChange={num("targetMarginPct")} /></Field>
            </div>
            <div className="mt-3"><Field label="Internal notes"><textarea className="field" rows={2} value={f.internalNotes} onChange={(ev) => setF({ ...f, internalNotes: ev.target.value })} /></Field></div>
          </fieldset>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => run(() => updateEstimate(projectId, e.id, { ...f, lineItems: items }), () => setOpen(false))}>Save draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
