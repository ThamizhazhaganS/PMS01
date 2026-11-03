import { ShieldAlert } from "lucide-react"
import { staffProject } from "@/lib/page-ctx"
import { audit, userName } from "@/lib/data"
import { fmtDateTime } from "@/lib/domain/rules"
import { Pill } from "@/components/shared/badges"
import { Section } from "@/components/shared/ui"

export default async function History({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await staffProject(projectId)
  const entries = audit(ctx)
  const director = ctx.membership?.role === "owner" || ctx.membership?.role === "director"
  return (
    <Section title="Activity log" eyebrow={`Append-only · ${entries.length} entries${director ? " · includes security events" : ""}`}>
      <p className="mb-4 text-xs text-muted-foreground">No user or role can edit or delete entries. Times shown in IST, stored in UTC.</p>
      <ol className="relative space-y-0 border-l pl-5">
        {entries.map((e) => (
          <li key={e.id} className="relative pb-4">
            <span className={`absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-card ${e.security ? "bg-bad" : "bg-muted-foreground/40"}`} aria-hidden />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{e.action}</span>
              {e.security && <Pill tone="bad"><ShieldAlert className="size-3" /> Security</Pill>}
            </div>
            <p className="text-sm text-muted-foreground">{e.detail}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{userName(e.actorId)} · {fmtDateTime(e.at)}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}
