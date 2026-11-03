import { NextResponse } from "next/server"
import { db } from "@/lib/store"
import { getViewer, projectCtx } from "@/lib/data"
import { canSeeAudience } from "@/lib/access/audience"

/**
 * Authenticated download (REQ-DOC-05 / NFR-07). Every request re-checks the
 * viewer's audience; refusals are a plain 404 that reveals nothing.
 * Stage 1 serves a placeholder; Stage 2 swaps in short-lived signed URLs.
 */
export async function GET(req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params
  const user = await getViewer()
  const doc = db().documents.find((d) => d.id === docId)
  const ctx = doc && projectCtx(user, doc.projectId)
  if (!doc || !ctx || !canSeeAudience(ctx, doc.audience, doc.authorId, "document") || doc.retracted)
    return new NextResponse("Not found", { status: 404 })
  const n = Number(new URL(req.url).searchParams.get("v")) || doc.versions.length
  const v = doc.versions.find((x) => x.n === n)
  if (!v) return new NextResponse("Not found", { status: 404 })
  const body = `CtrlPMS placeholder file\n\nDocument: ${doc.title}\nVersion: v${v.n} (${v.fileName})\nChange note: ${v.changeNote}\nDownloaded by: ${user!.email}\n`
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${v.fileName}.txt"`,
      "Cache-Control": "private, no-store",
    },
  })
}
