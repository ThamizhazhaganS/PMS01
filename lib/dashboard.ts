import "server-only"
import type { User } from "@/lib/domain/types"
import { ctxFor, milestones, needsYou, projectsFor } from "@/lib/data"
import { attentionFor } from "@/lib/attention"
import { fmtDate, todayIso } from "@/lib/domain/rules"

export type WeekTone = "bad" | "warn" | "plain"
export interface WeekItem { id: string; title: string; projectName: string; href: string; tone: WeekTone }
export interface WeekDay { date: string; label: string; today: boolean; items: WeekItem[] }

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Monday to Friday of this week (next week at the weekend) with every open
 * milestone due in it. Anything already late is pinned to today, or to the
 * first day shown, so it cannot be missed. Weekend dates land on Friday.
 */
export function weekStrip(user: User) {
  const today = todayIso()
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay() // 0 Sun … 6 Sat
  const monday = dow === 0 ? addDays(today, 1) : dow === 6 ? addDays(today, 2) : addDays(today, 1 - dow)
  const days: WeekDay[] = [0, 1, 2, 3, 4].map((i) => {
    const date = addDays(monday, i)
    const d = new Date(`${date}T00:00:00Z`)
    return { date, label: `${d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })} ${d.getUTCDate()}`, today: date === today, items: [] }
  })
  const friday = days[4].date
  const sunday = addDays(monday, 6)
  const pinTo = days.find((d) => d.today) ?? days[0]
  let count = 0

  for (const p of projectsFor(user)) {
    const ctx = ctxFor(user, p.id)!
    if (["closed", "cancelled", "archived"].includes(p.lifecycle)) continue
    for (const m of milestones(ctx)) {
      if (m.state === "accepted" || m.state === "dropped") continue
      const late = m.currentDate < today
      if (!late && (m.currentDate < monday || m.currentDate > sunday)) continue
      const waiting = m.state === "ready_for_review" || m.state === "changes_requested"
      const item: WeekItem = {
        id: m.id,
        title: late ? `${m.name} · overdue since ${fmtDate(m.currentDate)}` : m.name,
        projectName: p.name,
        href: `/w/projects/${p.id}/plan`,
        tone: late ? "bad" : waiting ? "warn" : "plain",
      }
      const day = late ? pinTo : days.find((d) => d.date === (m.currentDate > friday ? friday : m.currentDate))
      day?.items.push(item)
      count++
    }
  }
  for (const d of days) d.items.sort((a, b) => ["bad", "warn", "plain"].indexOf(a.tone) - ["bad", "warn", "plain"].indexOf(b.tone))
  return { days, count }
}

export interface AttentionRow { id: string; tone: "bad" | "warn" | "info"; title: string; detail: string; href: string }

/** Exceptions across the portfolio and items waiting for this user, in one list, worst first. */
export function attentionMerged(user: User): AttentionRow[] {
  const rows: AttentionRow[] = [
    ...attentionFor(user).map((a) => ({ id: a.id, tone: a.severity === "high" ? ("bad" as const) : ("warn" as const), title: a.title, detail: `${a.kind} · ${a.projectName}`, href: a.href })),
    ...needsYou(user).map((n) => ({ id: `n-${n.id}`, tone: n.overdue ? ("bad" as const) : ("info" as const), title: n.title, detail: `For you · ${n.projectName}`, href: n.href })),
  ]
  return rows.sort((a, b) => ["bad", "warn", "info"].indexOf(a.tone) - ["bad", "warn", "info"].indexOf(b.tone))
}
