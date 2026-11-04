"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useTheme } from "next-themes"
import { Check, ChevronDown, FlaskConical, Mail, Moon, RotateCcw, Sun } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { resetDemo, sendDigestNow, switchUser } from "@/lib/actions"
import { Pill } from "@/components/shared/badges"
import { useAction } from "@/components/shared/use-action"
import { fmtDateTime } from "@/lib/domain/rules"
import type { Email, Notification } from "@/lib/domain/types"
import { NotificationBell } from "@/components/shared/app-header-client"

export interface SwitchUser {
  id: string
  name: string
  role: string
  org: string
  extra?: boolean
  status: string
}

export function DevBarClient({ users, currentId, emails, notes, digestOn }: { users: SwitchUser[]; currentId: string; emails: Email[]; notes: Notification[]; digestOn: boolean }) {
  const [pending, start] = useTransition()
  const queued = emails.filter((e) => e.status === "queued_digest").length
  return (
    <div className="sticky top-0 z-40 border-b border-white/10 bg-[oklch(0.17_0.01_270)] text-[oklch(0.92_0.005_270)]">
      <div className="mx-auto flex h-10 max-w-[1400px] items-center gap-2 px-3 text-xs sm:px-5">
        <span className="hidden items-center gap-1.5 font-mono tracking-widest text-[oklch(0.74_0.14_280)] uppercase sm:flex">
          <FlaskConical className="size-3.5" /> Dev
        </span>
        <span className="hidden text-white/30 sm:inline">|</span>
        <span className="hidden text-white/60 md:inline">Viewing as</span>
        <RoleSwitcher users={users} currentId={currentId} onPick={(id) => start(() => switchUser(id))} />
        {pending && <span className="text-white/50">switching…</span>}
        <div className="ml-auto flex items-center gap-1">
          <NotificationBell items={notes} digestOn={digestOn} className="size-7 hover:bg-white/10" />
          <Outbox emails={emails} queued={queued} />
          <ThemeToggle />
          <button
            onClick={() => start(() => resetDemo())}
            className="inline-flex size-7 items-center justify-center rounded-md hover:bg-white/10"
            title="Reset demo data"
            aria-label="Reset demo data"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Plain disclosure menu: one click to open, one click to switch. */
function RoleSwitcher({ users, currentId, onPick }: { users: SwitchUser[]; currentId: string; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = users.find((u) => u.id === currentId)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])
  const group = (label: string, list: SwitchUser[]) => (
    <div role="group" aria-label={label}>
      <div className="px-2 pt-2 pb-1 text-[11px] font-medium text-muted-foreground">{label}</div>
      {list.map((u) => (
        <button
          key={u.id}
          onClick={() => {
            setOpen(false)
            if (u.id !== currentId) onPick(u.id)
          }}
          aria-current={u.id === currentId ? "true" : undefined}
          className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
        >
          <span className="mt-0.5 w-4">{u.id === currentId && <Check className="size-4" />}</span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {u.name} {u.status !== "active" && <span className="text-xs text-bad">({u.status})</span>}
            </span>
            <span className="block text-xs text-muted-foreground">
              {u.role} · {u.org}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
  return (
    <div ref={ref} className="relative min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Switch test user"
        className="inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md bg-white/10 px-2.5 font-medium hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-[oklch(0.74_0.14_280)] focus-visible:outline-none"
      >
        <span className="truncate">{current ? `${current.name} · ${current.role}` : "Choose user"}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-70" />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 max-h-[80dvh] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
          {group("Test users", users.filter((u) => !u.extra))}
          <div className="my-1 h-px bg-border" />
          {group("More test users", users.filter((u) => u.extra))}
        </div>
      )}
    </div>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="inline-flex size-7 items-center justify-center rounded-md hover:bg-white/10"
      aria-label="Toggle light or dark theme"
      title="Toggle theme"
    >
      <Sun className="hidden size-3.5 dark:block" />
      <Moon className="size-3.5 dark:hidden" />
    </button>
  )
}

function Outbox({ emails, queued }: { emails: Email[]; queued: number }) {
  const { pending, run } = useAction()
  return (
    <Sheet>
      <SheetTrigger aria-label="Dev outbox" className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 hover:bg-white/10">
        <Mail className="size-3.5" />
        <span className="hidden sm:inline">Outbox</span>
        <span className="rounded bg-white/15 px-1.5 font-mono text-[10px]">{emails.length}</span>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Dev outbox</SheetTitle>
          <SheetDescription>
            Simulated email. Tier 1 sends immediately and cannot be muted. Tier 2 waits for the daily digest.
          </SheetDescription>
        </SheetHeader>
        <div className="flex items-center justify-between gap-2 px-4">
          <span className="text-xs text-muted-foreground">{queued} update(s) queued for digest</span>
          <Button size="sm" variant="outline" disabled={pending || queued === 0} onClick={() => run(() => sendDigestNow())}>
            Send daily digest now
          </Button>
        </div>
        <ol className="flex-1 space-y-2 overflow-y-auto px-4 pb-6">
          {emails.length === 0 && <li className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No emails yet. Act as a user to trigger notifications.</li>}
          {emails.map((e) => (
            <li key={e.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <Pill tone={e.tier === 1 ? "bad" : "info"}>{e.tier === 1 ? "Urgent" : "Daily digest"}</Pill>
                <span className="text-[11px] text-muted-foreground">
                  {e.status === "sent" ? "Sent" : e.status === "queued_digest" ? "Queued · digest" : "Sent in digest"}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium">{e.subject}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">To {e.to}</p>
              <p className="truncate font-mono text-[11px] text-brand">{e.link}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{fmtDateTime(e.at)} · secure link only, no attachments</p>
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  )
}
