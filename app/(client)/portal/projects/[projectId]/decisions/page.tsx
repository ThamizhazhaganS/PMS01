import { clientProject } from "@/lib/page-ctx"
import { ClientDecisions } from "@/components/client/views"

export default async function Decisions({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await clientProject(projectId)
  return (
    <div className="max-w-4xl">
      <ClientDecisions ctx={ctx} />
    </div>
  )
}
