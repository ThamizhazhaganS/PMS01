"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { EstimateFields } from "@/lib/actions"
import { estimateTotals, fmtINR } from "@/lib/domain/rules"
import { Field } from "@/components/shared/ui"

export const blankEstimate = (): EstimateFields => ({
  lineItems: [{ id: `li-${Date.now()}`, label: "", qty: 1, unit: "days", rate: 0 }],
  effortDays: 0,
  durationWeeks: 0,
  expenses: 0,
  taxRate: 18,
  deliverables: [""],
  assumptions: [""],
  exclusions: [""],
  detailLevel: "line_items",
  validUntil: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
  costPerDay: 42000,
  targetMarginPct: 38,
  internalNotes: "",
})

/** Add/remove list of short lines (deliverables, assumptions, exclusions). */
function ListInput({ label, hint, items, onChange, placeholder }: { label: string; hint?: string; items: string[]; onChange: (xs: string[]) => void; placeholder: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        <Button size="xs" variant="outline" onClick={() => onChange([...items, ""])}><Plus /> Add</Button>
      </div>
      <div className="grid gap-2">
        {items.map((x, i) => (
          <div key={i} className="flex gap-2">
            <input aria-label={`${label} ${i + 1}`} className="field" placeholder={placeholder} value={x} onChange={(e) => onChange(items.map((y, j) => (j === i ? e.target.value : y)))} />
            {items.length > 1 && <Button size="icon" variant="ghost" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 /></Button>}
          </div>
        ))}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Every commercial field of an estimate version. Used when creating a project and when editing a draft. */
export function EstimateFieldsForm({ value: f, onChange }: { value: EstimateFields; onChange: (f: EstimateFields) => void }) {
  const set = <K extends keyof EstimateFields>(k: K, v: EstimateFields[K]) => onChange({ ...f, [k]: v })
  const num = (k: "effortDays" | "durationWeeks" | "expenses" | "taxRate" | "costPerDay" | "targetMarginPct") => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) || 0)
  const setItem = (i: number, patch: Partial<EstimateFields["lineItems"][number]>) => set("lineItems", f.lineItems.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const t = estimateTotals(f)
  const days = f.lineItems.reduce((s, x) => s + x.qty, 0)
  const margin = t.fees ? Math.round(((t.fees - days * f.costPerDay) / t.fees) * 100) : 0

  return (
    <div className="grid gap-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium">Line items (role · days · day rate ₹)</span>
          <Button size="xs" variant="outline" onClick={() => set("lineItems", [...f.lineItems, { id: `li-${Date.now()}`, label: "", qty: 1, unit: "days", rate: 0 }])}><Plus /> Add line</Button>
        </div>
        <div className="space-y-2">
          {f.lineItems.map((li, i) => (
            <div key={li.id} className="grid grid-cols-[1fr_5rem_7rem_auto] gap-2">
              <input aria-label={`Line item ${i + 1}`} className="field" placeholder="e.g. Senior consultant" value={li.label} onChange={(e) => setItem(i, { label: e.target.value })} />
              <input aria-label={`Days for line ${i + 1}`} type="number" min={0} className="field" value={li.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) || 0 })} />
              <input aria-label={`Day rate for line ${i + 1}`} type="number" min={0} className="field" value={li.rate} onChange={(e) => setItem(i, { rate: Number(e.target.value) || 0 })} />
              <Button size="icon" variant="ghost" aria-label={`Remove line ${i + 1}`} disabled={f.lineItems.length === 1} onClick={() => set("lineItems", f.lineItems.filter((_, j) => j !== i))}><Trash2 /></Button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-right text-sm">
          Fees {fmtINR(t.fees)} · Total incl. tax <b className="tabular-nums">{fmtINR(t.total)}</b>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Effort (person-days)"><input type="number" min={0} className="field" value={f.effortDays} onChange={num("effortDays")} /></Field>
        <Field label="Duration (weeks)"><input type="number" min={0} className="field" value={f.durationWeeks} onChange={num("durationWeeks")} /></Field>
        <Field label="Expenses (₹)"><input type="number" min={0} className="field" value={f.expenses} onChange={num("expenses")} /></Field>
        <Field label="Tax (%)"><input type="number" min={0} className="field" value={f.taxRate} onChange={num("taxRate")} /></Field>
      </div>

      <ListInput label="Deliverables" hint="Required before review — the client approves against this list." placeholder="e.g. Target operating model report" items={f.deliverables} onChange={(xs) => set("deliverables", xs)} />
      <div className="grid gap-5 sm:grid-cols-2">
        <ListInput label="Assumptions" placeholder="e.g. Client provides data owners" items={f.assumptions} onChange={(xs) => set("assumptions", xs)} />
        <ListInput label="Exclusions" placeholder="e.g. System implementation" items={f.exclusions} onChange={(xs) => set("exclusions", xs)} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Client sees">
          <select className="field" value={f.detailLevel} onChange={(e) => set("detailLevel", e.target.value as EstimateFields["detailLevel"])}>
            <option value="line_items">Line items + total</option>
            <option value="total">Total only</option>
          </select>
        </Field>
        <Field label="Valid until"><input type="date" className="field" value={f.validUntil} onChange={(e) => set("validUntil", e.target.value)} /></Field>
      </div>

      <fieldset className="rounded-lg border border-dashed border-warn/50 bg-warn-soft/40 p-3">
        <legend className="px-1 text-xs font-semibold text-warn">Internal cost assumptions — never shown to clients</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Internal cost per day (₹)"><input type="number" min={0} className="field" value={f.costPerDay} onChange={num("costPerDay")} /></Field>
          <Field label="Target margin (%)" hint={`Implied margin: ${margin}%`}><input type="number" className="field" value={f.targetMarginPct} onChange={num("targetMarginPct")} /></Field>
        </div>
        <div className="mt-3"><Field label="Internal notes"><textarea className="field" rows={2} value={f.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} /></Field></div>
      </fieldset>
    </div>
  )
}
