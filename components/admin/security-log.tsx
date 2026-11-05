"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

export interface LogEvent {
  id: string
  when: string
  action: string
  actor: string
  project: string
  projectName?: string
  org: string
  detail: string
}

type View = "time" | "org" | "project" | "user"
const VIEWS: { id: View; label: string }[] = [
  { id: "time", label: "All, by time" },
  { id: "org", label: "By organisation" },
  { id: "project", label: "By project" },
  { id: "user", label: "By user" },
]

/** Events most likely to need a second look. */
const SERIOUS = /self-grant|failed sign-in|deactivated|cancelled/i

/**
 * Rows magnify like a dock: the row under the mouse lifts out the most, its
 * neighbours a little, the rest stay put.
 */
function Rows({ events, hide }: { events: LogEvent[]; hide?: "project" | "actor" }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const cols = ["13rem", "11rem", ...(hide !== "actor" ? ["9rem"] : []), ...(hide !== "project" ? ["9rem"] : []), "minmax(14rem,1fr)"].join(" ")
  return (
    <div className="overflow-x-auto px-2 py-2">
      <div className="min-w-[44rem]" onMouseLeave={() => setHovered(null)}>
        <div className="grid gap-3 border-b px-3 py-2 text-xs text-muted-foreground" style={{ gridTemplateColumns: cols }}>
          <span>When (IST)</span>
          <span>Event</span>
          {hide !== "actor" && <span>Who</span>}
          {hide !== "project" && <span>Project</span>}
          <span>Detail</span>
        </div>
        {events.map((e, i) => {
          const d = hovered === null ? 99 : Math.abs(i - hovered)
          return (
            <div
              key={e.id}
              onMouseEnter={() => setHovered(i)}
              style={{ gridTemplateColumns: cols }}
              className={cn(
                "relative grid origin-center items-start gap-3 rounded-xl px-3 py-2.5 text-sm transition-[transform,background-color,box-shadow] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none",
                d === 0 && "z-10 scale-[1.025] bg-card shadow-lg ring-1 ring-border motion-reduce:scale-100",
                d === 1 && "scale-[1.01] bg-muted/40 motion-reduce:scale-100",
                d > 1 && "border-b border-transparent",
              )}
            >
              <span className="text-xs whitespace-nowrap tabular-nums">{e.when}</span>
              <span className={cn("font-medium", SERIOUS.test(e.action + e.detail) && "text-bad")}>{e.action}</span>
              {hide !== "actor" && <span className="text-xs">{e.actor}</span>}
              {hide !== "project" && <span className="text-xs">{e.project}</span>}
              <span className="text-xs text-muted-foreground">{e.detail}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Groups keep the newest-first order inside each group; groups with the latest activity come first. */
function Grouped({ events, keyOf, hide }: { events: LogEvent[]; keyOf: (e: LogEvent) => string; hide?: "project" | "actor" }) {
  const groups = new Map<string, LogEvent[]>()
  for (const e of events) groups.set(keyOf(e), [...(groups.get(keyOf(e)) ?? []), e])
  return (
    <div className="space-y-3">
      {[...groups.entries()].map(([name, list], i) => (
        <details key={name} open={i === 0} className="group rounded-2xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5">
            <span className="font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">
              {list.length} event{list.length === 1 ? "" : "s"} · latest {list[0].when}
            </span>
          </summary>
          <div className="border-t px-3 pb-2">
            <Rows events={list} hide={hide} />
          </div>
        </details>
      ))}
    </div>
  )
}

export function SecurityLog({ events }: { events: LogEvent[] }) {
  const [view, setView] = useState<View>("time")
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Group the log" className="inline-flex flex-wrap gap-1 rounded-xl bg-muted p-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={view === v.id}
            onClick={() => setView(v.id)}
            className={cn("h-8 rounded-lg px-3 text-sm text-muted-foreground transition hover:text-foreground", view === v.id && "bg-background font-medium text-foreground shadow-xs")}
          >
            {v.label}
          </button>
        ))}
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No security events yet.</p>
      ) : view === "time" ? (
        <div className="rounded-2xl border bg-card px-3 pb-2">
          <Rows events={events} />
        </div>
      ) : view === "org" ? (
        <Grouped events={events} keyOf={(e) => e.org} />
      ) : view === "project" ? (
        <Grouped events={events} keyOf={(e) => (e.projectName ? `${e.projectName} · ${e.project}` : "Platform-wide (no project)")} hide="project" />
      ) : (
        <Grouped events={events} keyOf={(e) => e.actor} hide="actor" />
      )}
      <p className="text-xs text-muted-foreground">Events in red usually need a second look: self-grants, failed sign-ins, deactivations and cancellations.</p>
    </div>
  )
}
