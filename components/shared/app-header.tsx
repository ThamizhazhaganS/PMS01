import Link from "next/link"
import type { User } from "@/lib/domain/types"
import { ROLE_LABEL } from "@/lib/domain/rules"
import { notificationsFor, orgById } from "@/lib/data"
import { db } from "@/lib/store"
import { Initials } from "./ui"
import { NavLinks, NotificationBell } from "./app-header-client"

export function Brand({ sub }: { sub?: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="PulsePlatform home">
      <span className="relative flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12h4l2-5 4 10 2-5h6" />
        </svg>
      </span>
      <span className="leading-none">
        <span className="block text-sm font-semibold tracking-tight">PulsePlatform</span>
        {sub && <span className="block text-[11px] text-muted-foreground">{sub}</span>}
      </span>
    </Link>
  )
}

export function AppHeader({ user, nav, sub }: { user: User; nav: { href: string; label: string; count?: number }[]; sub: string }) {
  const notes = notificationsFor(user.id).slice(0, 30)
  const org = orgById(user.orgId)
  return (
    <header className="border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
        <Brand sub={sub} />
        <NavLinks items={nav} />
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell items={notes} digestOn={!db().digestOptOut[user.id]} />
          <div className="hidden items-center gap-2 sm:flex">
            <Initials name={user.name} />
            <div className="leading-tight">
              <div className="text-xs font-medium">{user.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {ROLE_LABEL[user.kind]} · {org?.name}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
