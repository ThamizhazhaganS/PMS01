import Link from "next/link"
import { notFound } from "next/navigation"
import { Eye } from "lucide-react"
import { staffProject } from "@/lib/page-ctx"
import { ctxFor, userById } from "@/lib/data"
import { db } from "@/lib/store"
import { audit } from "@/lib/effects"
import { canViewAs, hasShell, isClient } from "@/lib/access/audience"
import { ROLE_LABEL } from "@/lib/domain/rules"
import { ClientDecisions, ClientDocuments, ClientJourney, ClientOverview, clientSections } from "@/components/client/views"
import { buttonVariants } from "@/components/ui/button"

/** REQ-ACC-07: read-only preview exactly as a chosen client user sees it. Logged. */
export default async function ViewAs({ params }: { params: Promise<{ projectId: string; userId: string }> }) {
  const { projectId, userId } = await params
  const ctx = await staffProject(projectId)
  if (!canViewAs(ctx)) notFound()
  const target = userById(userId)
  if (!target || !isClient(target)) notFound()
  const tctx = ctxFor(target, projectId)
  if (!tctx || !hasShell(tctx)) notFound()

  // Log once per minute per viewer/target (rendering may repeat).
  const recent = db().audit.find((a) => a.projectId === projectId && a.actorId === ctx.user.id && a.action === "View as" && a.detail.includes(target.name) && Date.now() - new Date(a.at).getTime() < 60_000)
  if (!recent) audit(ctx.user.id, "View as", `${ctx.user.name} previewed the project as ${target.name}`, projectId, true)

  const sec = clientSections(tctx)
  return (
    <div className="space-y-8">
      <div role="status" className="sticky top-12 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand-soft p-3 text-sm shadow-sm">
        <span className="flex items-center gap-2">
          <Eye className="size-4 text-brand" />
          Viewing as <b>{target.name}</b> ({ROLE_LABEL[target.kind]}). Read-only preview — this session is logged.
        </span>
        <Link href={`/w/projects/${projectId}/people`} className={buttonVariants({ size: "sm", variant: "outline" })}>Exit preview</Link>
      </div>
      <section aria-label="Overview"><h2 className="eyebrow mb-3">Overview</h2><ClientOverview ctx={tctx} readOnly base="#" /></section>
      {sec.journey && <section aria-label="Journey"><h2 className="eyebrow mb-3">Journey</h2><div className="max-w-3xl"><ClientJourney ctx={tctx} /></div></section>}
      {sec.documents && <section aria-label="Documents"><h2 className="eyebrow mb-3">Documents</h2><ClientDocuments ctx={tctx} readOnly /></section>}
      {sec.decisions && <section aria-label="Decisions"><h2 className="eyebrow mb-3">Decisions & agreements</h2><ClientDecisions ctx={tctx} readOnly /></section>}
      {!sec.journey && !sec.documents && !sec.decisions && <p className="text-sm text-muted-foreground">This user currently sees only the project shell.</p>}
    </div>
  )
}
