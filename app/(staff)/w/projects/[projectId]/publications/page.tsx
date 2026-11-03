import Link from "next/link"
import { CalendarClock, FileText, Lock, Paperclip, Plus } from "lucide-react"
import { staffProject } from "@/lib/page-ctx"
import { decisions, documents, pickerData, publications, threadViews, userName, wsName, actions } from "@/lib/data"
import { audienceLabel, canPublish, isProjectDirector } from "@/lib/access/audience"
import { daysBetween, fmtDate, fmtDateTime } from "@/lib/domain/rules"
import { AudienceBadge, Pill } from "@/components/shared/badges"
import { Empty, Section } from "@/components/shared/ui"
import { buttonVariants } from "@/components/ui/button"
import { CommentThreads } from "@/components/shared/comment-thread"
import { DocumentActions, PublicationActions, UploadDialog } from "@/components/staff/publication-controls"

export default async function Publications({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await staffProject(projectId)
  const pubs = publications(ctx)
  const docs = documents(ctx)
  const data = pickerData(ctx)
  const pub = canPublish(ctx)
  const director = isProjectDirector(ctx)
  const decs = decisions(ctx)
  const acts = actions(ctx)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Everything starts as a private Draft. Publishing is deliberate: pick an audience, check recipients, confirm. {!pub && <b className="text-warn">You don&apos;t have the publish right — you can prepare drafts.</b>}
        </p>
        <div className="flex gap-2">
          <UploadDialog projectId={projectId} />
          <Link href={`/w/projects/${projectId}/publications/new`} className={buttonVariants({ size: "sm" })}>
            <Plus /> New meeting record
          </Link>
        </div>
      </div>

      <Section title="Meeting records & publications" eyebrow="Sorted by actual meeting date">
        {pubs.length === 0 ? (
          <Empty title="Nothing here yet" hint="After each meeting, publish the record in one guided flow." />
        ) : (
          <ul className="space-y-3">
            {pubs.map((p) => {
              const late = p.meetingAt && p.publishedAt && daysBetween(p.meetingAt, p.publishedAt) >= 2
              return (
                <li key={p.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Pill>{p.kind}</Pill>
                        {p.state === "draft" ? <AudienceBadge kind="draft" label="Draft" /> : <AudienceBadge kind={p.audience.kind} label={audienceLabel(p.audience, wsName)} />}
                        {p.version > 1 && <Pill tone="info">v{p.version}</Pill>}
                        {p.supersededById && <Pill>Superseded</Pill>}
                        {p.retracted && <Pill tone="bad">Retracted</Pill>}
                        {p.actionRequired && <Pill tone="brand">Action required</Pill>}
                      </div>
                      <h3 className="mt-2 font-semibold">{p.title}</h3>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {p.meetingAt && <span className="inline-flex items-center gap-1"><CalendarClock className="size-3" /> Met {fmtDateTime(p.meetingAt)}</span>}
                        {p.publishedAt && <span>· Published {fmtDateTime(p.publishedAt)}</span>}
                        {late && <Pill tone="warn">Uploaded later</Pill>}
                        <span>· by {userName(p.authorId)}</span>
                      </p>
                    </div>
                    <PublicationActions projectId={projectId} data={data} canPublish={pub} isDirector={director} pub={{ id: p.id, title: p.title, summary: p.summary, state: p.state, superseded: !!p.supersededById, retracted: !!p.retracted }} />
                  </div>
                  {p.retracted ? (
                    <p className="mt-3 rounded-md bg-bad-soft p-2 text-sm text-bad">Retracted {fmtDate(p.retracted.at)}: {p.retracted.reason}</p>
                  ) : (
                    <>
                      <p className="mt-3 text-sm">{p.summary}</p>
                      {p.changeNote && <p className="mt-1 text-xs text-muted-foreground">Change note: {p.changeNote}</p>}
                      {p.attendeeIds.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Attendees: {p.attendeeIds.map(userName).join(", ")}</p>}
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        {p.decisionIds.length > 0 && (
                          <div className="text-xs"><div className="eyebrow mb-1">Decisions</div><ul className="list-inside list-disc">{p.decisionIds.map((id) => <li key={id}>{decs.find((d) => d.id === id)?.statement}</li>)}</ul></div>
                        )}
                        {p.actionIds.length > 0 && (
                          <div className="text-xs"><div className="eyebrow mb-1">Actions</div><ul className="list-inside list-disc">{p.actionIds.map((id) => { const a = acts.find((x) => x.id === id); return a && <li key={id}>{a.description} — {userName(a.ownerId)}</li> })}</ul></div>
                        )}
                        {p.attachments.length > 0 && (
                          <div className="text-xs"><div className="eyebrow mb-1">Attachments</div>
                            <ul className="space-y-1">{p.attachments.map((a) => { const d = docs.find((x) => x.id === a.documentId); return d && !("restricted" in d) && <li key={a.documentId} className="flex flex-wrap items-center gap-1"><Paperclip className="size-3" /> {d.title} v{a.version} <AudienceBadge kind={d.audience.kind} label={audienceLabel(d.audience, wsName)} /></li> })}</ul>
                          </div>
                        )}
                      </div>
                      {p.teamRemarks && (
                        <p className="mt-3 flex gap-2 rounded-md border border-dashed border-warn/50 bg-warn-soft/40 p-2 text-xs"><Lock className="mt-0.5 size-3 shrink-0 text-warn" /><span><b>Team remarks</b> (never shown to clients): {p.teamRemarks}</span></p>
                      )}
                      {p.state === "published" && <CommentThreads projectId={projectId} subject={{ kind: "publication", id: p.id }} threads={threadViews(ctx, p.id)} staff />}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section title="Documents" eyebrow="Versioned · v1, v2… earlier versions retained">
        <ul className="divide-y">
          {docs.map((d) => {
            if ("restricted" in d)
              return (
                <li key={d.id} className="flex items-center gap-3 py-3 text-sm text-muted-foreground"><Lock className="size-4" /> Restricted item · {d.kind} — you are not on the named list</li>
              )
            const cur = d.versions.at(-1)!
            return (
              <li key={d.id} className="grid gap-2 py-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{d.title}</span>
                    <Pill tone="ok">Current v{cur.n}</Pill>
                    <AudienceBadge kind={d.audience.kind} label={audienceLabel(d.audience, wsName)} />
                    {d.retracted && <Pill tone="bad">Retracted</Pill>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {cur.fileName} · {cur.sizeKb.toLocaleString("en-IN")} KB · {fmtDate(cur.uploadedAt)} by {userName(cur.uploadedBy)} — “{cur.changeNote}”
                  </p>
                  {d.versions.length > 1 && (
                    <details className="mt-1 text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Earlier versions ({d.versions.length - 1})</summary>
                      <ul className="mt-1 space-y-0.5 pl-4">{d.versions.slice(0, -1).reverse().map((v) => <li key={v.n}>v{v.n} · {v.fileName} · {fmtDate(v.uploadedAt)} — {v.changeNote}</li>)}</ul>
                    </details>
                  )}
                  {d.retracted && <p className="mt-1 text-xs text-bad">Retracted {fmtDate(d.retracted.at)}: {d.retracted.reason}</p>}
                </div>
                <DocumentActions projectId={projectId} data={data} canPublish={pub} isDirector={director} doc={{ id: d.id, title: d.title, audience: d.audience, retracted: !!d.retracted }} />
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}
