import { clientProject } from "@/lib/page-ctx"
import { ClientOverview } from "@/components/client/views"

export default async function ClientProjectOverview({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ approve?: string }> }) {
  const { projectId } = await params
  const { approve } = await searchParams
  const ctx = await clientProject(projectId)
  return <ClientOverview ctx={ctx} openApproval={approve} base={`/portal/projects/${projectId}`} />
}
