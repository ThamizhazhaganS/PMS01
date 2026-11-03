"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { Notification } from "@/lib/domain/types"
import { markAllRead, setDigest } from "@/lib/actions"
import { relDays } from "@/lib/domain/rules"
import { useAction } from "./use-action"

export function NavLinks({ items }: { items: { href: string; label: string; count?: number }[] }) {
  const path = usePathname()
  return (
    <nav aria-label="Primary" className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {items.map((i) => {
        const active = i.href === path || (i.href !== "/" && path.startsWith(i.href + "/") && !items.some((o) => o.href !== i.href && o.href.startsWith(i.href) && path.startsWith(o.href)))
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
              active && "bg-muted font-medium text-foreground",
            )}
          >
            {i.label}
            {!!i.count && <span className="rounded-full bg-brand px-1.5 text-[10px] leading-4 font-semibold text-brand-foreground">{i.count}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

export function NotificationBell({ items, digestOn }: { items: Notification[]; digestOn: boolean }) {
  const unread = items.filter((n) => !n.read).length
  const { run, pending } = useAction()
  return (
    <Popover>
      <PopoverTrigger className="relative inline-flex size-9 items-center justify-center rounded-md hover:bg-muted" aria-label={`Notifications, ${unread} unread`}>
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-4 rounded-full bg-bad px-1 text-center text-[10px] leading-4 font-semibold text-white">{unread}</span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          <button className="text-xs text-brand hover:underline disabled:opacity-50" disabled={unread === 0} onClick={() => markAllRead()}>
            Mark all read
          </button>
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</li>}
          {items.map((n) => (
            <li key={n.id} className={cn("border-b last:border-0", !n.read && "bg-brand-soft/40")}>
              <Link href={n.href} className="block px-3 py-2.5 hover:bg-muted">
                <div className="flex items-start gap-2">
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.tier === 1 ? "bg-bad" : "bg-info")} aria-label={n.tier === 1 ? "Urgent" : "Update"} />
                  <div className="min-w-0">
                    <p className="text-sm leading-snug">{n.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {n.tier === 1 ? "Action required · emailed now" : "Update · daily digest"} · {relDays(n.at)}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <label className="flex items-center justify-between gap-3 border-t px-3 py-2.5 text-xs">
          <span>
            Daily digest email
            <span className="block text-muted-foreground">Urgent emails can&apos;t be turned off.</span>
          </span>
          <Switch checked={digestOn} disabled={pending} onCheckedChange={(v) => run(() => setDigest(!!v))} />
        </label>
      </PopoverContent>
    </Popover>
  )
}
