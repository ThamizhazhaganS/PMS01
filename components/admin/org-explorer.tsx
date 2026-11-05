"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ConfirmCancelButton, SelfGrantButton } from "./admin-controls"

export interface ExplorerOrg {
  id: string
  name: string
  code: string
  kind: string
  people: { id: string; name: string; role: string }[]
  projects: { id: string; name: string; code: string; state: string; granted: boolean; cancelRequest?: { by: string; reason: string } }[]
}

/**
 * Organisations on the left; clicking one opens it up and the right-hand
 * panel shows its projects and people. Click, not hover, so a long list can
 * be scanned without the panel jumping around.
 */
export function OrgExplorer({ orgs }: { orgs: ExplorerOrg[] }) {
  const [activeId, setActiveId] = useState(orgs.find((o) => o.projects.length > 0)?.id ?? orgs[0]?.id)
  const active = orgs.find((o) => o.id === activeId) ?? orgs[0]
  if (!active) return null
  const many = orgs.length > 6
  return (
    <section className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]" aria-label="Organisations">
      <div className="min-w-0">
      {/* A fixed-height box of its own, so a long list scrolls here and not the whole page. */}
      <ul
        className={cn(
          "grid max-h-72 content-start gap-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin] lg:max-h-[24rem]",
          many && "pb-6 [mask-image:linear-gradient(to_bottom,black_88%,transparent)]",
        )}
        role="tablist"
        aria-orientation="vertical"
        aria-label="Organisations"
      >
        {orgs.map((o) => {
          const on = o.id === active.id
          return (
            <li key={o.id}>
              <button
                role="tab"
                aria-selected={on}
                aria-controls="org-panel"
                onClick={() => setActiveId(o.id)}
                className={cn("w-full rounded-xl px-4 py-3 text-left transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", on ? "bg-muted" : "hover:bg-muted/50")}
              >
                <span className={cn("flex items-center gap-2 text-base", on ? "font-medium text-foreground" : "text-muted-foreground")}>
                  <span className={cn("size-1.5 shrink-0 rounded-full bg-foreground transition-opacity", on ? "opacity-100" : "opacity-0")} aria-hidden />
                  {o.name}
                </span>
                <span className={cn("grid transition-all duration-300", on ? "mt-1 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                  <span className="overflow-hidden pl-3.5 text-xs text-muted-foreground">
                    {o.kind} · {o.people.length} {o.people.length === 1 ? "user" : "users"} · {o.projects.length} {o.projects.length === 1 ? "project" : "projects"}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {many && <p className="mt-2 px-4 text-xs text-muted-foreground">{orgs.length} organisations · scroll the list for more</p>}
      </div>

      <div id="org-panel" role="tabpanel" className="rounded-2xl border bg-card p-6">
        <div key={active.id} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
          <div className="flex items-center justify-between gap-3 border-b pb-3 text-xs text-muted-foreground">
            <span className="font-mono tracking-wide">{active.code}</span>
            <span>{active.kind}</span>
          </div>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight">{active.name}</h3>

          <div className="mt-5">
            <p className="text-xs text-muted-foreground">Projects · name and state only</p>
            {active.projects.length === 0 ? (
              <p className="mt-2 rounded-lg bg-muted/60 px-4 py-3 text-sm text-muted-foreground">{active.kind === "Consulting firm" ? "No projects here. Projects belong to client organisations." : "No projects yet. Use New project to start one for this client."}</p>
            ) : (
              <ul className="mt-2 divide-y rounded-lg bg-muted/40">
                {active.projects.map((p) => (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.code} · {p.state}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {p.cancelRequest && <ConfirmCancelButton projectId={p.id} />}
                        <SelfGrantButton projectId={p.id} granted={p.granted} />
                      </div>
                    </div>
                    {p.cancelRequest && (
                      <p className="mt-2 rounded-md bg-bad-soft p-2 text-xs">
                        <b>Cancellation requested</b> by {p.cancelRequest.by}: “{p.cancelRequest.reason}” — your confirmation is the second check.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5">
            <p className="text-xs text-muted-foreground">People</p>
            {active.people.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No users yet. Use Invite user to add someone.</p>}
            <ul className="mt-2 flex flex-wrap gap-2">
              {active.people.map((u) => (
                <li key={u.id} className="rounded-full border px-3 py-1 text-xs">
                  <span className="font-medium">{u.name}</span> <span className="text-muted-foreground">· {u.role}</span>
                </li>
              ))}
            </ul>
          </div>

          {active.projects.length > 0 && <p className="mt-5 text-xs text-muted-foreground">Self-granting access is logged as a security event and alerts the project&apos;s CEO immediately.</p>}
        </div>
      </div>
    </section>
  )
}
