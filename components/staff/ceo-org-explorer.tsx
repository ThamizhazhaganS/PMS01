"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CeoOrg {
  id: string
  name: string
  summary: string
  projects: { id: string; name: string; health?: "on_track" | "at_risk" | "delayed"; note: string; over?: boolean; href: string }[]
}

const DOT = { on_track: "bg-ok", at_risk: "bg-warn", delayed: "bg-bad" }
const HEALTH = { on_track: "On track", at_risk: "At risk", delayed: "Delayed" }

/** Clients on the left (scrolls when long); click one to see its projects. */
export function CeoOrgExplorer({ orgs }: { orgs: CeoOrg[] }) {
  const [activeId, setActiveId] = useState(orgs[0]?.id)
  const active = orgs.find((o) => o.id === activeId) ?? orgs[0]
  if (!active) return null
  return (
    <section className="rounded-2xl border bg-card p-5" aria-labelledby="clients-h">
      <h2 id="clients-h" className="text-base font-semibold">Organisations</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)]">
        <ul className="grid max-h-72 content-start gap-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin] md:max-h-[22rem]" role="tablist" aria-orientation="vertical" aria-label="Organisations">
          {orgs.map((o) => {
            const on = o.id === active.id
            return (
              <li key={o.id}>
                <button
                  role="tab"
                  aria-selected={on}
                  aria-controls="client-panel"
                  onClick={() => setActiveId(o.id)}
                  className={cn("w-full rounded-xl px-3 py-2.5 text-left transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", on ? "bg-muted" : "hover:bg-muted/50")}
                >
                  <span className={cn("flex items-center gap-2 text-sm", on ? "font-medium text-foreground" : "text-muted-foreground")}>
                    <span className={cn("size-1.5 shrink-0 rounded-full bg-foreground transition-opacity", on ? "opacity-100" : "opacity-0")} aria-hidden />
                    {o.name}
                  </span>
                  <span className={cn("grid transition-all duration-300", on ? "mt-0.5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                    <span className="overflow-hidden pl-3.5 text-xs text-muted-foreground">{o.summary}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div id="client-panel" role="tabpanel" className="min-w-0">
          <div key={active.id} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
            {active.projects.length === 0 ? (
              <p className="rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">No projects for this client yet.</p>
            ) : (
              <ul className="divide-y">
                {active.projects.map((p) => (
                  <li key={p.id}>
                    <Link href={p.href} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition hover:bg-muted/60">
                      <span className={cn("size-2 shrink-0 rounded-full", p.health ? DOT[p.health] : "bg-muted-foreground/40")} aria-label={p.health ? HEALTH[p.health] : "No status yet"} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                      <span className={cn("shrink-0 text-xs", p.over ? "font-medium text-bad" : "text-muted-foreground")}>{p.note}</span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/w/orgs/${active.id}`} className="mt-3 inline-flex items-center gap-1 text-xs text-brand hover:underline">
              Open {active.name} <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
