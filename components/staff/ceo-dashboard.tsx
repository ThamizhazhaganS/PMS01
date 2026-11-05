import Link from "next/link"
import { Activity, CircleAlert, Clock, Hourglass, IndianRupee, Stamp } from "lucide-react"
import type { totals } from "@/lib/portfolio"
import type { AttentionRow, WeekDay } from "@/lib/dashboard"
import { fmtINR } from "@/lib/domain/rules"
import { cn } from "@/lib/utils"
import { HealthBar } from "./dashboard"

type Totals = ReturnType<typeof totals>

function Headline({ icon: Icon, label, children, sub }: { icon: typeof Clock; label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-brand" aria-hidden /> {label}
      </div>
      {children}
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

/** The four numbers a CEO checks every day. */
export function Headlines({ t }: { t: Totals }) {
  const timePct = t.agreedHours > 0 ? Math.round((t.loggedHours / t.agreedHours) * 100) : undefined
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Headline icon={Activity} label="Project health">
        <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{t.live} live</div>
        <HealthBar health={t.health} className="mt-3 h-1.5" />
      </Headline>
      <Headline icon={Stamp} label="Waiting on client" sub={t.overdueApprovals ? <span className="text-bad">{t.overdueApprovals} overdue</span> : "None overdue"}>
        <div className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", t.overdueApprovals > 0 && "text-bad")}>{t.pendingApprovals}</div>
      </Headline>
      <Headline icon={Hourglass} label="Time used" sub={timePct === undefined ? "No approved estimates yet" : undefined}>
        <div className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", timePct !== undefined && timePct > 100 && "text-bad")}>{timePct !== undefined ? `${timePct}%` : "—"}</div>
        {timePct !== undefined && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full", timePct > 100 ? "bg-bad" : timePct >= 85 ? "bg-warn" : "bg-ok")} style={{ width: `${Math.min(100, timePct)}%` }} />
          </div>
        )}
      </Headline>
      <Headline icon={IndianRupee} label="Agreed value" sub="Approved estimates">
        <div className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums">{fmtINR(t.agreedValue)}</div>
      </Headline>
    </div>
  )
}

const TAG = { bad: "bg-bad-soft text-bad", warn: "bg-warn-soft text-warn", plain: "bg-muted text-foreground" }

/** Monday to Friday, with each milestone under its day. */
export function WeekStrip({ days, count }: { days: WeekDay[]; count: number }) {
  return (
    <section className="rounded-2xl border bg-card p-5" aria-labelledby="week-h">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="week-h" className="text-base font-semibold">This week</h2>
        <span className="text-xs text-muted-foreground">{count === 0 ? "Nothing due this week" : `${count} milestone${count === 1 ? "" : "s"} due`}</span>
      </div>
      <ol className="mt-4 grid grid-cols-5 gap-2">
        {days.map((d) => (
          <li key={d.date} className="min-w-0">
            <p className={cn("text-xs", d.today ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {d.label}
              {d.today && " · today"}
            </p>
            <div className={cn("my-2 h-1 rounded-full", d.today ? "bg-brand" : "bg-muted")} aria-hidden />
            <div className="grid gap-1.5">
              {d.items.map((i) => (
                <Link key={i.id} href={i.href} title={`${i.title} · ${i.projectName}`} className={cn("block truncate rounded-md px-2 py-1.5 text-xs transition hover:opacity-80", TAG[i.tone])}>
                  {i.title}
                  <span className="block truncate text-[11px] opacity-70">{i.projectName}</span>
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

const ICON = { bad: CircleAlert, warn: Clock, info: Clock }
const TONE = { bad: "text-bad", warn: "text-warn", info: "text-info" }

function AttentionItems({ rows }: { rows: AttentionRow[] }) {
  return (
    <ul className="divide-y">
      {rows.map((r) => {
        const Icon = ICON[r.tone]
        return (
          <li key={r.id}>
            <Link href={r.href} className="-mx-2 flex items-start gap-2.5 rounded-lg px-2 py-2.5 transition hover:bg-muted/60">
              <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[r.tone])} aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm leading-snug font-medium">{r.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** One list for exceptions and items waiting for the CEO; the rest folds away. */
export function AttentionPanel({ rows, show = 4 }: { rows: AttentionRow[]; show?: number }) {
  return (
    <section className="rounded-2xl border bg-card p-5" aria-labelledby="attn-h">
      <h2 id="attn-h" className="text-base font-semibold">Needs attention</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing is overdue or waiting. Everything is moving.</p>
      ) : (
        <div className="mt-1">
          <AttentionItems rows={rows.slice(0, show)} />
          {rows.length > show && (
            <details className="group">
              <summary className="mt-1 cursor-pointer list-none text-sm text-brand hover:underline group-open:hidden">See all {rows.length}</summary>
              <AttentionItems rows={rows.slice(show)} />
            </details>
          )}
        </div>
      )}
    </section>
  )
}
