import Link from "next/link"
import type { User } from "@/lib/domain/types"
import { ROLE_LABEL } from "@/lib/domain/rules"
import { orgById } from "@/lib/data"
import { Initials } from "./ui"
import { NavLinks, SearchShortcut } from "./app-header-client"
import { Search } from "lucide-react"

export function Brand({ sub }: { sub?: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="CtrlPMS home">
      <span className="relative flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        {/* A "C" drawn as a control dial: the open ring is the C, the dot is the knob. */}
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M17.66 6.34A8 8 0 1 0 17.66 17.66" />
          <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="leading-none">
        <span className="block text-sm font-semibold tracking-tight">CtrlPMS</span>
        {sub && <span className="hidden text-[11px] text-muted-foreground sm:block">{sub}</span>}
      </span>
    </Link>
  )
}

export function AppHeader({ user, nav, sub, searchAction }: { user: User; nav: { href: string; label: string; count?: number }[]; sub: string; searchAction?: string }) {
  const org = orgById(user.orgId)
  return (
    <header className="border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Brand sub={sub} />
        <NavLinks items={nav} />
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          {searchAction && <SearchShortcut href={searchAction} />}
          {searchAction && (
            <form action={searchAction} role="search" className="hidden md:block">
              <label className="relative block">
                <span className="sr-only">Search</span>
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input name="q" placeholder="Search…" className="field h-8 w-44 pr-12 pl-8 text-xs lg:w-56" />
                <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border px-1 font-mono text-[10px] text-muted-foreground">Ctrl K</kbd>
              </label>
            </form>
          )}
          {searchAction && (
            <Link href={searchAction} className="inline-flex size-9 items-center justify-center rounded-md hover:bg-muted md:hidden" aria-label="Search">
              <Search className="size-4" />
            </Link>
          )}
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
