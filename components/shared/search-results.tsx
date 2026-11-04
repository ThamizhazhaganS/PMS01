import Link from "next/link"
import { Lock, Search } from "lucide-react"
import type { User } from "@/lib/domain/types"
import { MIN_QUERY, search } from "@/lib/search"
import { Pill } from "./badges"
import { PageTitle } from "./ui"

export function SearchPage({ user, q, action }: { user: User; q: string; action: string }) {
  const hits = search(user, q)
  return (
    <div className="max-w-3xl">
      <PageTitle eyebrow="Search" title={q ? <>Results for <em>“{q}”</em></> : "Search"}>
        Only items shared with you are searched. Items not shared with you never appear, not even as a count.
      </PageTitle>
      <form action={action} className="mb-6 flex gap-2" role="search">
        <label className="relative flex-1">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input name="q" defaultValue={q} autoFocus className="field h-10 pl-9" placeholder="Documents, decisions, meetings, comments…" />
        </label>
        <button className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Search</button>
      </form>
      {q.trim().length > 0 && q.trim().length < MIN_QUERY && <p className="text-sm text-muted-foreground">Type at least {MIN_QUERY} characters.</p>}
      {q.trim().length >= MIN_QUERY && hits.length === 0 && <p className="text-sm text-muted-foreground">No matches in items shared with you.</p>}
      <ul className="space-y-2">
        {hits.map((h) => (
          <li key={`${h.kind}-${h.id}`}>
            <Link href={h.href} className="block rounded-xl border bg-card p-4 transition hover:border-foreground/20">
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Pill tone={h.kind === "Team remarks" ? "warn" : "muted"}>
                  {h.kind === "Team remarks" && <Lock className="size-3" />}
                  {h.kind}
                </Pill>
                <span>{h.projectName}</span>
              </div>
              <p className="mt-1.5 font-medium">{h.title}</p>
              {h.snippet && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{h.snippet}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
