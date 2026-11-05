"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Building2, ChevronDown, MoreHorizontal, Plus, Search } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { adminSelfGrant, setUserStatus, type Result } from "@/lib/actions"
import { Pill } from "@/components/shared/badges"
import { Initials } from "@/components/shared/ui"
import { useAction } from "@/components/shared/use-action"
import { cn } from "@/lib/utils"
import { OrgDialog } from "./admin-controls"

export interface DirOrg { id: string; name: string; kind: string; users: number; projects: number }
export interface DirUser { id: string; name: string; email: string; orgId: string; role: string; projects: number; status: string; note?: string }
export interface DirProject { id: string; name: string; code: string; orgId: string; state: string; granted: boolean }

/** Closes on outside click or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close()
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close()
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open, close])
  return ref
}

/** "+ New" menu: organisation (dialog) or project (page). */
export function NewMenu() {
  const [open, setOpen] = useState(false)
  const [orgOpen, setOrgOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="outline" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        <Plus /> New <ChevronDown className="opacity-60" />
      </Button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 w-52 rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
          <button className="flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted" onClick={() => { setOpen(false); setOrgOpen(true) }}>New organisation</button>
          <Link href="/admin/projects/new" className="flex w-full items-center rounded-md px-2.5 py-2 text-sm hover:bg-muted" onClick={() => setOpen(false)}>New project</Link>
        </div>
      )}
      <OrgDialog open={orgOpen} onOpenChange={setOrgOpen} />
    </div>
  )
}

interface MenuItem { label: string; danger?: boolean; confirm: { title: string; body: string; cta: string }; run: () => Promise<Result> }

/** A row's "⋯" menu. Every item asks for confirmation first. */
function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const [asking, setAsking] = useState<MenuItem | null>(null)
  const ref = useDismiss(open, () => setOpen(false))
  const { pending, run } = useAction()
  if (items.length === 0) return null
  return (
    <div ref={ref} className="relative inline-block">
      <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${label}`} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal />
      </Button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-1 w-56 rounded-lg bg-popover p-1 text-left text-popover-foreground shadow-lg ring-1 ring-foreground/10">
          {items.map((i) => (
            <button key={i.label} className={cn("flex w-full rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted", i.danger && "text-bad")} onClick={() => { setOpen(false); setAsking(i) }}>
              {i.label}
            </button>
          ))}
        </div>
      )}
      <Dialog open={!!asking} onOpenChange={(o) => !o && setAsking(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{asking?.confirm.title}</DialogTitle>
            <DialogDescription>{asking?.confirm.body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAsking(null)}>Cancel</Button>
            <Button variant={asking?.danger ? "destructive" : "default"} disabled={pending} onClick={() => asking && run(asking.run, () => setAsking(null))}>{asking?.confirm.cta}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const STATUS_PILL: Record<string, { tone: "info" | "bad"; label: string }> = {
  invited: { tone: "info", label: "Invited" },
  deactivated: { tone: "bad", label: "Deactivated" },
}

/** Organisations act as a filter over users and projects; users can be searched. */
export function AdminDirectory({ orgs, users, projects, adminId }: { orgs: DirOrg[]; users: DirUser[]; projects: DirProject[]; adminId: string }) {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name ?? ""
  const needle = q.trim().toLowerCase()
  const shownUsers = users.filter((u) => (!orgId || u.orgId === orgId) && (!needle || `${u.name} ${u.email}`.toLowerCase().includes(needle)))
  const shownProjects = projects.filter((p) => !orgId || p.orgId === orgId)

  return (
    <div className="space-y-5">
      <section aria-labelledby="orgs-h">
        <h2 id="orgs-h" className="sr-only">Organisations</h2>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Show organisation">
          {[{ id: null as string | null, name: "All organisations", detail: `${users.length} users · ${projects.length} projects` }, ...orgs.map((o) => ({ id: o.id as string | null, name: o.name, detail: `${o.users} users · ${o.projects} projects` }))].map((o) => (
            <button
              key={o.id ?? "all"}
              role="radio"
              aria-checked={orgId === o.id}
              onClick={() => setOrgId(o.id)}
              className={cn("flex items-center gap-2.5 rounded-xl border bg-card px-3.5 py-2.5 text-left transition hover:border-foreground/25", orgId === o.id && "border-brand bg-brand-soft/50 ring-1 ring-brand")}
            >
              <Building2 className={cn("size-4", orgId === o.id ? "text-brand" : "text-muted-foreground")} aria-hidden />
              <span>
                <span className="block text-sm font-medium">{o.name}</span>
                <span className="block text-xs text-muted-foreground">{o.detail}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5" aria-labelledby="users-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="users-h" className="text-base font-semibold">Users <span className="font-normal text-muted-foreground">({shownUsers.length})</span></h2>
          <label className="relative block w-full sm:w-64">
            <span className="sr-only">Search users</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input className="field h-8 pl-8 text-sm" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        {shownUsers.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No users match.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Person</th>
                  {!orgId && <th className="py-2 font-medium">Organisation</th>}
                  <th className="py-2 font-medium">Role</th>
                  <th className="py-2 text-right font-medium">Projects</th>
                  <th className="w-12 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shownUsers.map((u) => {
                  const pill = STATUS_PILL[u.status]
                  return (
                    <tr key={u.id} className="border-b transition last:border-0 hover:bg-muted/40">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <Initials name={u.name} className="size-8 text-[11px]" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 font-medium">
                              {u.name}
                              {pill && <Pill tone={pill.tone}>{pill.label}</Pill>}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">{u.email}{u.note && ` · ${u.note}`}</div>
                          </div>
                        </div>
                      </td>
                      {!orgId && <td className="py-2.5 pr-3 text-muted-foreground">{orgName(u.orgId)}</td>}
                      <td className="py-2.5 pr-3">{u.role}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{u.projects}</td>
                      <td className="py-2.5 text-right">
                        {u.id !== adminId && u.status !== "invited" && (
                          <RowMenu
                            label={u.name}
                            items={[
                              u.status === "active"
                                ? { label: "Deactivate", danger: true, confirm: { title: `Deactivate ${u.name}?`, body: "They are signed out and can no longer open CtrlPMS. Their records stay. You can reactivate them later.", cta: "Deactivate" }, run: () => setUserStatus(u.id, "deactivated") }
                                : { label: "Reactivate", confirm: { title: `Reactivate ${u.name}?`, body: "They can sign in again with the same access as before.", cta: "Reactivate" }, run: () => setUserStatus(u.id, "active") },
                            ]}
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5" aria-labelledby="projects-h">
        <h2 id="projects-h" className="text-base font-semibold">Projects <span className="font-normal text-muted-foreground">({shownProjects.length})</span></h2>
        <p className="mt-0.5 text-xs text-muted-foreground">You see the name and state only. Documents, meetings and estimates stay with the project team.</p>
        <ul className="mt-2 divide-y">
          {shownProjects.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  {p.name}
                  {p.granted && <Pill tone="bad">Temporary access on</Pill>}
                </div>
                <div className="text-xs text-muted-foreground">{p.code} · {orgName(p.orgId)} · {p.state}</div>
              </div>
              {!p.granted && (
                <RowMenu
                  label={p.name}
                  items={[{ label: "Get temporary access…", danger: true, confirm: { title: "Get temporary access?", body: `You get view-only access to ${p.name}. This is logged as a security event and the project's CEO is alerted immediately.`, cta: "Get access" }, run: () => adminSelfGrant(p.id) }]}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
