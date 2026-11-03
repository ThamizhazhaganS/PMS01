import { clientProject } from "@/lib/page-ctx"
import { ClientJourney } from "@/components/client/views"

export default async function Journey({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await clientProject(projectId)
  return (
    <div className="max-w-3xl">
      <p className="mb-5 text-sm text-muted-foreground">Original and current dates. Where a date moved, tap it to see why.</p>
      <ClientJourney ctx={ctx} />
    </div>
  )
}
