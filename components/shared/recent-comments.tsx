import Link from "next/link"
import { Lock, MessageSquare } from "lucide-react"
import type { recentComments } from "@/lib/data"
import { relDays } from "@/lib/domain/rules"
import { Initials } from "./ui"

/** The newest comments on a project, each with the update it belongs to. */
export function RecentComments({ items, href }: { items: ReturnType<typeof recentComments>; href: string }) {
  return (
    <section className="rounded-2xl border bg-card p-5" aria-labelledby="comments-h">
      <div className="flex items-center justify-between gap-2">
        <h2 id="comments-h" className="flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="size-4 text-brand" aria-hidden /> Recent comments
        </h2>
        <Link href={href} className="text-xs text-brand hover:underline">All updates</Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No comments yet. Comments on updates and files appear here.</p>
      ) : (
        <ul className="mt-2 divide-y">
          {items.map((c) => (
            <li key={c.id}>
              <Link href={href} className="-mx-2 flex gap-3 rounded-lg px-2 py-3 transition hover:bg-muted/60">
                <Initials name={c.author} className="size-7 text-[10px]" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{c.author}</span>
                    on “{c.item}” · {relDays(c.at)}
                    {c.teamOnly && (
                      <span className="inline-flex items-center gap-1 rounded bg-warn-soft px-1.5 text-warn">
                        <Lock className="size-3" aria-hidden /> Team only
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-sm">{c.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
