"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  ["overview", "Overview"],
  ["plan", "Plan"],
  ["commercial", "Commercial"],
  ["publications", "Publications"],
  ["decisions", "Decisions"],
  ["people", "People & Access"],
  ["history", "History"],
] as const

export function ProjectTabs({ projectId }: { projectId: string }) {
  const path = usePathname()
  return (
    <nav aria-label="Project sections" className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {TABS.map(([slug, label], i) => {
          const href = `/w/projects/${projectId}/${slug}`
          const active = path.startsWith(href)
          return (
            <li key={slug}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center gap-2 px-3 text-sm text-muted-foreground transition hover:text-foreground",
                  active && "font-medium text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-foreground",
                )}
              >
                <span className="font-mono text-[10px] text-muted-foreground/70">{String(i + 1).padStart(2, "0")}</span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
