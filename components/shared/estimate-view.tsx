import type { Estimate } from "@/lib/domain/types"
import { estimateTotals, fmtDate, fmtINR } from "@/lib/domain/rules"

/** Estimate body. `clientView` hides line items when the version is "total only". */
export function EstimateBody({ e, total, clientView }: { e: Estimate; total?: number; clientView?: boolean }) {
  const t = estimateTotals(e)
  const showLines = !clientView || e.detailLevel === "line_items"
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div><dt className="eyebrow">Total incl. tax</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{fmtINR(total ?? t.total)}</dd></div>
        <div><dt className="eyebrow">Effort</dt><dd className="mt-1 font-medium">{e.effortDays} person-days</dd></div>
        <div><dt className="eyebrow">Duration</dt><dd className="mt-1 font-medium">{e.durationWeeks} weeks</dd></div>
        <div><dt className="eyebrow">Valid until</dt><dd className="mt-1 font-medium">{fmtDate(e.validUntil)}</dd></div>
      </dl>
      <div>
        <h4 className="eyebrow mb-1.5">Scope</h4>
        <p className="text-sm">{e.scope}</p>
      </div>
      <div>
        <h4 className="eyebrow mb-1.5">Deliverables</h4>
        <ul className="list-inside list-disc text-sm">{e.deliverables.map((d) => <li key={d}>{d}</li>)}</ul>
      </div>
      {showLines && e.lineItems.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Rate</th>
                <th className="py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {e.lineItems.map((li) => (
                <tr key={li.id} className="border-b">
                  <td className="py-2">{li.label}</td>
                  <td className="py-2 text-right">{li.qty} {li.unit}</td>
                  <td className="py-2 text-right">{fmtINR(li.rate)}</td>
                  <td className="py-2 text-right">{fmtINR(li.qty * li.rate)}</td>
                </tr>
              ))}
              <tr><td className="py-1.5 text-muted-foreground" colSpan={3}>Expenses</td><td className="py-1.5 text-right">{fmtINR(e.expenses)}</td></tr>
              <tr><td className="py-1.5 text-muted-foreground" colSpan={3}>Tax ({e.taxRate}%)</td><td className="py-1.5 text-right">{fmtINR(t.tax)}</td></tr>
              <tr className="font-semibold"><td className="py-2" colSpan={3}>Total</td><td className="py-2 text-right">{fmtINR(t.total)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      {clientView && e.detailLevel === "total" && <p className="text-xs text-muted-foreground">This estimate is shared as a total. Ask your Morphoverse CEO for a breakdown.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="eyebrow mb-1.5">Assumptions</h4>
          <ul className="list-inside list-disc text-sm text-muted-foreground">{e.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
        <div>
          <h4 className="eyebrow mb-1.5">Exclusions</h4>
          <ul className="list-inside list-disc text-sm text-muted-foreground">{e.exclusions.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      </div>
      {e.scheduleSnapshot.length > 0 && (
        <div>
          <h4 className="eyebrow mb-1.5">Schedule snapshot</h4>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {e.scheduleSnapshot.map((s) => (
              <li key={s.milestoneId} className="flex justify-between gap-2 border-b py-1"><span className="truncate">{s.name}</span><span className="tabular-nums text-muted-foreground">{fmtDate(s.date)}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
