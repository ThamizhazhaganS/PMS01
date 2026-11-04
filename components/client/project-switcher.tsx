"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Check, ChevronDown, ChevronRight } from "lucide-react"

/** Breadcrumb for client project pages, with a one-click jump to another project. */
export function ClientBreadcrumb({ home, projects, currentId }: { home: { href: string; label: string }; projects: { id: string; name: string; code: string; href: string }[]; currentId: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = projects.find((p) => p.id === currentId)
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
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <Link href={home.href} className="hover:text-foreground">{home.label}</Link>
      <ChevronRight className="size-3.5" aria-hidden />
      {projects.length > 1 ? (
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-haspopup="true"
            aria-label="Switch project"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-foreground hover:bg-muted"
          >
            {current?.code}
            <ChevronDown className="size-3.5 opacity-70" />
          </button>
          {open && (
            <div className="absolute top-full left-0 z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
              <div className="px-2 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground">Your projects</div>
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={p.href}
                  onClick={() => setOpen(false)}
                  aria-current={p.id === currentId ? "page" : undefined}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                >
                  <span className="mt-0.5 w-4">{p.id === currentId && <Check className="size-4" />}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{p.code}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        <span className="text-foreground">{current?.code}</span>
      )}
    </nav>
  )
}
