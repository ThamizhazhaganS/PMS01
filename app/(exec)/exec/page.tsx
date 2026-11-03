import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { ctxFor, projectsFor, summary } from "@/lib/data"
import { attentionFor } from "@/lib/attention"
import { requireUser } from "@/lib/page-ctx"
import { fmtDate, fmtINR } from "@/lib/domain/rules"
import { HealthBadge, LifecycleBadge, Pill } from "@/components/shared/badges"
import { PageTitle } from "@/components/shared/ui"

export default async function Portfolio() {
  const user = await requireUser(["exec"])
  const rows = projectsFor(user).map((p) => summary(ctxFor(user, p.id)!))
  const attention = attentionFor(user)
  const counts = { on_track: 0, at_risk: 0, delayed: 0 }
  rows.forEach((r) => r.status && counts[r.status.health]++)
  const committed = rows.reduce((s, r) => s + (r.approvedTotal ?? 0), 0)

  return (
    <>
      <PageTitle eyebrow="Nova Industries · All Morphoverse engagements" title={<>Portfolio, <em>at a glance</em>.</>}>
        Client-visible status only. Internal Morphoverse notes are never part of this view.
      </PageTitle>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label="Engagements" value={rows.length} />
        <Tile label="On track" value={counts.on_track} tone="ok" />
        <Tile label="At risk" value={counts.at_risk} tone="warn" />
        <Tile label="Delayed" value={counts.delayed} tone="bad" />
        <Tile label="Agreed spend" value={fmtINR(committed)} small />
      </div>

      {attention.length > 0 && (
        <Link href="/exec/attention" className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-bad/30 bg-bad-soft/60 p-4 transition hover:border-bad/50">
          <div>
            <div className="text-sm font-semibold">{attention.length} item{attention.length > 1 ? "s" : ""} need attention</div>
            <div className="text-xs text-muted-foreground">{[...new Set(attention.map((a) => a.kind))].join(" · ")}</div>
          </div>
          <ArrowRight className="size-4" />
        </Link>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[60rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="p-3 font-medium">Engagement</th>
              <th className="p-3 font-medium">Health</th>
              <th className="p-3 font-medium">Owner</th>
              <th className="p-3 font-medium">Next milestone</th>
              <th className="p-3 font-medium">Progress</th>
              <th className="p-3 text-center font-medium">Overdue approvals</th>
              <th className="p-3 text-center font-medium">Open changes</th>
              <th className="p-3 text-center font-medium">Blockers</th>
              <th className="p-3 text-right font-medium">Agreed cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.project.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="p-3">
                  <Link href={`/portal/projects/${r.project.id}`} className="font-medium hover:underline">{r.project.name}</Link>
                  <div className="mt-1 flex flex-wrap gap-1"><LifecycleBadge lifecycle={r.project.lifecycle} />{r.stale && r.project.lifecycle !== "proposal" && <Pill tone="warn">Stale</Pill>}</div>
                </td>
                <td className="p-3"><HealthBadge health={r.status?.health} /></td>
                <td className="p-3 text-xs">{r.owner?.name}</td>
                <td className="p-3 text-xs">{r.next ? <><div className="font-medium">{r.next.name}</div><div className="text-muted-foreground">{fmtDate(r.next.currentDate)}</div></> : "—"}</td>
                <td className="p-3 text-xs tabular-nums">{r.progress.accepted} of {r.progress.total} accepted</td>
                <td className="p-3 text-center"><Count n={r.overdueApprovals.length} bad /></td>
                <td className="p-3 text-center"><Count n={r.openChanges.length} /></td>
                <td className="p-3 text-center"><Count n={r.openBlockers.length} bad /></td>
                <td className="p-3 text-right tabular-nums">{r.approvedTotal !== undefined ? fmtINR(r.approvedTotal) : <span className="text-xs text-muted-foreground">Awaiting approval</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Tile({ label, value, tone, small }: { label: string; value: React.ReactNode; tone?: "ok" | "warn" | "bad"; small?: boolean }) {
  const c = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : ""
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 font-semibold tabular-nums ${small ? "text-lg" : "text-3xl"} ${c}`}>{value}</div>
    </div>
  )
}

function Count({ n, bad }: { n: number; bad?: boolean }) {
  if (!n) return <span className="text-muted-foreground">0</span>
  return <span className={`inline-flex min-w-6 justify-center rounded-full px-1.5 text-xs font-semibold leading-5 ${bad ? "bg-bad-soft text-bad" : "bg-info-soft text-info"}`}>{n}</span>
}
