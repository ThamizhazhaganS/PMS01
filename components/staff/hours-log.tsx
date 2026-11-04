"use client"

import { useState } from "react"
import { Clock, Pencil, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { deleteHours, recordHours, updateHours } from "@/lib/actions"
import type { TimeEntry } from "@/lib/domain/types"
import { fmtDate } from "@/lib/domain/rules"
import { Field } from "@/components/shared/ui"
import { useAction } from "@/components/shared/use-action"

const today = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
const fmtHours = (h: number) => h.toLocaleString("en-IN", { maximumFractionDigits: 2 })

export function LogHoursDialog({ projectId, minDate, entry }: { projectId: string; minDate: string; entry?: TimeEntry }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(entry?.date ?? today())
  const [hours, setHours] = useState(String(entry?.hours ?? 8))
  const [note, setNote] = useState(entry?.note ?? "")
  const { pending, run } = useAction()
  const save = () => {
    const input = { date, hours: Number(hours), note }
    return entry ? updateHours(projectId, entry.id, input) : recordHours(projectId, input)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setDate(entry?.date ?? today())
          setHours(String(entry?.hours ?? 8))
          setNote(entry?.note ?? "")
        }
      }}
    >
      {entry ? (
        <DialogTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`Edit ${entry.hours} hours on ${fmtDate(entry.date)}`} />}>
          <Pencil />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button size="sm" />}>
          <Clock /> Log hours
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit hours" : "Log hours"}</DialogTitle>
          <DialogDescription>The client sees only the total hours used, never individual entries.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" className="field" value={date} min={minDate} max={today()} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Hours">
              <input type="number" className="field" min={0.25} max={24} step={0.25} value={hours} onChange={(e) => setHours(e.target.value)} />
            </Field>
          </div>
          <Field label="What did you work on? (optional)">
            <input className="field" placeholder="e.g. Stakeholder interviews" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={() => run(save, () => setOpen(false))}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Hours per person for the CEO: total and the last 7 days. */
export function HoursByPerson({ rows }: { rows: { userId: string; name: string; total: number; lastWeek: number }[] }) {
  if (rows.length === 0) return null
  return (
    <table className="mb-4 w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="pb-1.5 font-medium">Person</th>
          <th className="pb-1.5 text-right font-medium">Last 7 days</th>
          <th className="pb-1.5 text-right font-medium">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.userId} className="border-b last:border-0">
            <td className="py-1.5">{r.name}</td>
            <td className="py-1.5 text-right tabular-nums">{fmtHours(r.lastWeek)} h</td>
            <td className="py-1.5 text-right font-medium tabular-nums">{fmtHours(r.total)} h</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Recent entries: your own, or everyone's for the CEO. */
export function HoursList({
  projectId,
  entries,
  seesAll,
  viewerId,
  minDate,
  editable,
}: {
  projectId: string
  entries: (TimeEntry & { name: string })[]
  seesAll: boolean
  viewerId: string
  minDate: string
  editable: boolean
}) {
  const [showAll, setShowAll] = useState(false)
  const { pending, run } = useAction()
  const shown = showAll ? entries : entries.slice(0, 6)
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No hours logged yet.</p>
  return (
    <div>
      <ul className="divide-y">
        {shown.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2 py-2 first:pt-0">
            <div className="min-w-0 text-sm">
              <p className="truncate">
                <span className="font-medium tabular-nums">{fmtHours(t.hours)} h</span>
                {t.note && <span className="text-muted-foreground"> · {t.note}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtDate(t.date)}
                {seesAll && ` · ${t.name}`}
              </p>
            </div>
            {editable && (seesAll || t.userId === viewerId) && (
              <div className="flex shrink-0">
                <LogHoursDialog projectId={projectId} minDate={minDate} entry={t} />
                <Button size="icon-sm" variant="ghost" aria-label={`Remove ${t.hours} hours on ${fmtDate(t.date)}`} disabled={pending} onClick={() => run(() => deleteHours(projectId, t.id))}>
                  <Trash2 />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {entries.length > 6 && (
        <button className="mt-2 text-xs text-brand hover:underline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${entries.length} entries`}
        </button>
      )}
    </div>
  )
}
