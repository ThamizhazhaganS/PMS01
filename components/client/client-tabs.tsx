"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

/** Empty client sections are hidden entirely (UX-06). */
export function ClientTabs({ projectId, sections, needs = 0 }: { projectId: string; sections: { journey: boolean; documents: boolean; decisions: boolean }; needs?: number }) {
  const path = usePathname()
  const base = `/portal/projects/${projectId}`
  const tabs = [
    { href: base, label: "Overview", show: true, count: needs },
    { href: `${base}/journey`, label: "Timeline", show: sections.journey },
    { href: `${base}/documents`, label: "Documents", show: sections.documents },
    { href: `${base}/decisions`, label: "Decisions & agreements", show: sections.decisions },
  ].filter((t) => t.show)
  return (
    <nav aria-label="Project" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="inline-flex min-w-max gap-1 rounded-xl bg-muted p-1">
        {tabs.map((t) => {
          const active = t.href === base ? path === base : path.startsWith(t.href)
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={cn("inline-flex h-9 items-center rounded-lg px-3.5 text-sm text-muted-foreground transition hover:text-foreground", active && "bg-background font-medium text-foreground shadow-xs")}>
                {t.label}
                {!!t.count && <span className="ml-1.5 rounded-full bg-brand px-1.5 text-[10px] leading-4 font-semibold text-brand-foreground" aria-label={`${t.count} need you`}>{t.count}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
