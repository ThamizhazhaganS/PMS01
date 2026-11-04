import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { staffProject } from "@/lib/page-ctx"
import { documents, pickerData, wsName } from "@/lib/data"
import { audienceLabel, canPublish } from "@/lib/access/audience"
import { MeetingWizard } from "@/components/staff/meeting-wizard"

export default async function NewMeeting({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await staffProject(projectId)
  const docs = documents(ctx)
    .filter((d) => !("restricted" in d) && !d.retracted)
    .map((d) => d as Exclude<typeof d, { restricted: true }>)
    .map((d) => ({ id: d.id, title: d.title, version: d.versions.length, audience: audienceLabel(d.audience, wsName) }))
  return (
    <div>
      <Link href={`/w/projects/${projectId}/publications`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Updates & files
      </Link>
      <h2 className="display mb-5 text-2xl">New meeting record</h2>
      <MeetingWizard data={pickerData(ctx)} docs={docs} canPublish={canPublish(ctx)} />
    </div>
  )
}
