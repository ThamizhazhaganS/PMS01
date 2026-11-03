import Link from "next/link"
import { EyeOff, Info } from "lucide-react"
import { staffProject } from "@/lib/page-ctx"
import { estimates, userName } from "@/lib/data"
import { isProjectDirector } from "@/lib/access/audience"
import { estimateTotals, fmtDate, fmtINR } from "@/lib/domain/rules"
import type { Estimate } from "@/lib/domain/types"
import { EstimateStateBadge } from "@/components/shared/badges"
import { EstimateBody } from "@/components/shared/estimate-view"
import { ActionButton } from "@/components/shared/dialogs"
import { Empty, Section } from "@/components/shared/ui"
import { EstimateEditor } from "@/components/staff/estimate-editor"
import { advanceEstimate, newEstimateVersion } from "@/lib/actions"
import { cn } from "@/lib/utils"

export default async function Commercial({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ v?: string; compare?: string }> }) {
  const { projectId } = await params
  const sp = await searchParams
  const ctx = await staffProject(projectId)
  const list = estimates(ctx)
  const director = isProjectDirector(ctx)
  const sel = list.find((e) => String(e.version) === sp.v) ?? list.find((e) => e.state === "draft" || e.state === "internal_review" || e.state === "shared") ?? list[0]
  const cmp = list.find((e) => String(e.version) === sp.compare)
  const base = `/w/projects/${projectId}/commercial`

  return (
    <div className="grid gap-5 lg:grid-cols-[17rem_1fr]">
      <aside className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Versions</h2>
          {director && <ActionButton size="xs" onRun={newEstimateVersion.bind(null, projectId)}>New version</ActionButton>}
        </div>
        {list.length === 0 && <Empty title="No estimate yet" hint="CEOs draft the commercial estimate here." />}
        <ul className="space-y-2">
          {list.map((e) => (
            <li key={e.id}>
              <Link href={`${base}?v=${e.version}`} className={cn("block rounded-lg border p-3 transition hover:border-foreground/20", sel?.id === e.id && "border-foreground/40 bg-muted")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">v{e.version}</span>
                  <EstimateStateBadge state={e.state} />
                </div>
                <div className="mt-1 text-sm tabular-nums">{fmtINR(estimateTotals(e).total)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {e.approvedAt ? `Approved ${fmtDate(e.approvedAt)}` : e.sharedAt ? `Shared ${fmtDate(e.sharedAt)}` : `Drafted ${fmtDate(e.createdAt)}`}
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <p className="flex gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" /> Project cost is derived from the approved version. At most one version is approved at a time.
        </p>
      </aside>

      {sel && (
        <div className="space-y-5">
          <Section
            eyebrow={`Estimate v${sel.version} · by ${userName(sel.createdBy)}`}
            title={<span className="flex items-center gap-2">Commercial estimate <EstimateStateBadge state={sel.state} /></span>}
            action={
              <>
                {list.length > 1 && (
                  <nav className="flex items-center gap-1 text-xs" aria-label="Compare with">
                    <span className="text-muted-foreground">Compare</span>
                    {list.filter((e) => e.id !== sel.id).map((e) => (
                      <Link key={e.id} className={cn("rounded px-1.5 py-0.5 hover:bg-muted", cmp?.id === e.id && "bg-muted font-medium")} href={`${base}?v=${sel.version}&compare=${e.version}`}>v{e.version}</Link>
                    ))}
                  </nav>
                )}
                {director && sel.state === "draft" && <EstimateEditor projectId={projectId} e={sel} />}
                {director && sel.state === "draft" && <ActionButton onRun={advanceEstimate.bind(null, projectId, sel.id, "review")}>To internal review</ActionButton>}
                {director && sel.state === "internal_review" && <ActionButton variant="default" onRun={advanceEstimate.bind(null, projectId, sel.id, "share")}>Share with client</ActionButton>}
                {director && sel.state === "shared" && <ActionButton variant="ghost" onRun={advanceEstimate.bind(null, projectId, sel.id, "withdraw")}>Withdraw</ActionButton>}
              </>
            }
          >
            {cmp && <Compare a={sel} b={cmp} />}
            <EstimateBody e={sel} />
            <p className="mt-5 text-xs text-muted-foreground">
              Client sees: {sel.detailLevel === "line_items" ? "line items and total" : "total only"}. Approval is a record of agreement only; not a contract or payment authorization.
            </p>
          </Section>

          <section className="rounded-xl border border-dashed border-warn/50 bg-warn-soft/30 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-warn"><EyeOff className="size-4" /> Internal cost assumptions — Morphoverse only</h3>
            <dl className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div><dt className="eyebrow">Cost per day</dt><dd className="mt-1 tabular-nums">{fmtINR(sel.internal.costPerDay)}</dd></div>
              <div><dt className="eyebrow">Target margin</dt><dd className="mt-1">{sel.internal.targetMarginPct}%</dd></div>
              <div><dt className="eyebrow">Implied margin</dt><dd className="mt-1">{impliedMargin(sel)}%</dd></div>
            </dl>
            {sel.internal.notes && <p className="mt-3 text-sm text-muted-foreground">{sel.internal.notes}</p>}
          </section>
        </div>
      )}
    </div>
  )
}

function impliedMargin(e: Estimate) {
  const fees = estimateTotals(e).fees
  const cost = e.lineItems.reduce((s, x) => s + x.qty, 0) * e.internal.costPerDay
  return fees ? Math.round(((fees - cost) / fees) * 100) : 0
}

function Compare({ a, b }: { a: Estimate; b: Estimate }) {
  const ta = estimateTotals(a).total
  const tb = estimateTotals(b).total
  const rows: [string, string, string, boolean][] = [
    ["Total", fmtINR(tb), fmtINR(ta), ta !== tb],
    ["Effort", `${b.effortDays} d`, `${a.effortDays} d`, a.effortDays !== b.effortDays],
    ["Duration", `${b.durationWeeks} w`, `${a.durationWeeks} w`, a.durationWeeks !== b.durationWeeks],
    ["Scope", b.scope, a.scope, a.scope !== b.scope],
    ["Deliverables", b.deliverables.join("; "), a.deliverables.join("; "), a.deliverables.join() !== b.deliverables.join()],
    ["Valid until", fmtDate(b.validUntil), fmtDate(a.validUntil), a.validUntil !== b.validUntil],
  ]
  return (
    <div className="mb-6 overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[32rem] text-sm">
        <thead><tr className="border-b bg-muted text-left text-xs"><th className="p-2 font-medium">Field</th><th className="p-2 font-medium">v{b.version}</th><th className="p-2 font-medium">v{a.version}</th></tr></thead>
        <tbody>
          {rows.map(([k, x, y, diff]) => (
            <tr key={k} className={cn("border-b last:border-0", diff && "bg-brand-soft/50")}>
              <td className="p-2 text-muted-foreground">{k}{diff && " •"}</td><td className="p-2">{x}</td><td className="p-2 font-medium">{y}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
