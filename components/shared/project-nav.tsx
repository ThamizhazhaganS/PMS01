"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarRange, CheckCircle2, FolderOpen, History, IndianRupee, LayoutDashboard, Route, Users } from "lucide-react"
import { cn } from "@/lib/utils"

const ICONS = { overview: LayoutDashboard, plan: CalendarRange, timeline: Route, commercial: IndianRupee, files: FolderOpen, approvals: CheckCircle2, team: Users, history: History }

export interface ProjectNavItem {
  href: string
  label: string
  icon: keyof typeof ICONS
  count?: number
  /** Overview-style links match only their exact path. */
  exact?: boolean
  /** Shown apart at the bottom of the sidebar (e.g. History). */
  secondary?: boolean
  /** One plain sentence shown under the section heading. */
  intro?: string
}

const activeItem = (items: ProjectNavItem[], path: string) =>
  items.find((i) => (i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/")))

/** The current section's name and what it is for, at the top of the content. */
export function SectionHeading({ items }: { items: ProjectNavItem[] }) {
  const current = activeItem(items, usePathname())
  if (!current) return null
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold tracking-tight">{current.label}</h2>
      {current.intro && <p className="mt-1 text-sm text-muted-foreground">{current.intro}</p>}
    </div>
  )
}

/**
 * Project sections: a left sidebar on large screens, a scrolling tab row on
 * small ones. One list of links, so both always match.
 */
export function ProjectNav({ items, label = "Project sections" }: { items: ProjectNavItem[]; label?: string }) {
  const path = usePathname()
  const isActive = (i: ProjectNavItem) => activeItem(items, path) === i
  const link = (i: ProjectNavItem, layout: "side" | "tab") => {
    const Icon = ICONS[i.icon]
    const active = isActive(i)
    return (
      <Link
        key={i.href}
        href={i.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex shrink-0 items-center gap-2.5 rounded-lg text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          layout === "side" ? "h-10 px-3" : "h-9 px-3",
          active && "bg-muted font-medium text-foreground",
        )}
      >
        <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-muted-foreground")} aria-hidden />
        <span className="truncate">{i.label}</span>
        {!!i.count && <span className="ml-auto rounded-full bg-brand px-1.5 text-[10px] leading-4 font-semibold text-brand-foreground" aria-label={`${i.count} waiting`}>{i.count}</span>}
      </Link>
    )
  }
  const main = items.filter((i) => !i.secondary)
  const extra = items.filter((i) => i.secondary)
  return (
    <>
      <nav aria-label={label} className="sticky top-14 hidden self-start lg:block">
        <div className="grid gap-0.5">{main.map((i) => link(i, "side"))}</div>
        {extra.length > 0 && <div className="mt-3 grid gap-0.5 border-t pt-3">{extra.map((i) => link(i, "side"))}</div>}
      </nav>
      <nav aria-label={label} className="-mx-4 overflow-x-auto border-b px-4 pb-2 lg:hidden">
        <div className="flex min-w-max gap-1">{items.map((i) => link(i, "tab"))}</div>
      </nav>
    </>
  )
}
