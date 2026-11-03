import Link from "next/link"
import { ArrowUpRight, Ban, CircleDollarSign, Clock, PauseCircle, Stamp } from "lucide-react"
import { attentionFor } from "@/lib/attention"
import { orgById } from "@/lib/data"
import { requireUser } from "@/lib/page-ctx"
import { Pill } from "@/components/shared/badges"
import { Empty, PageTitle } from "@/components/shared/ui"

const ICON = { "Overdue approval": Stamp, "Commercial change": CircleDollarSign, "Long-standing blocker": Ban, "Stale status": Clock, "Paused project": PauseCircle }

export default async function Attention() {
  const user = await requireUser(["exec"])
  const items = attentionFor(user)
  return (
    <div className="max-w-4xl">
      <PageTitle eyebrow={`Exceptions across ${orgById(user.orgId)?.name}`} title="Needs attention">
        Overdue approvals, commercial changes, long-standing blockers, stale statuses and paused projects.
      </PageTitle>
      {items.length === 0 ? (
        <Empty title="Nothing needs attention" hint="All engagements are moving without exceptions." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((i) => {
            const Icon = ICON[i.kind]
            return (
              <li key={i.id}>
                <Link href={i.href} className="group flex h-full flex-col rounded-xl border bg-card p-4 transition hover:border-foreground/20">
                  <div className="flex items-center justify-between gap-2">
                    <Pill tone={i.severity === "high" ? "bad" : "warn"}><Icon className="size-3" /> {i.kind}</Pill>
                    <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-foreground" />
                  </div>
                  <p className="mt-3 font-medium">{i.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{i.detail}</p>
                  <p className="mt-auto pt-3 text-xs text-muted-foreground">{i.projectName}</p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
