import { clientProject } from "@/lib/page-ctx"
import { ClientDocuments } from "@/components/client/views"

export default async function Documents({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const ctx = await clientProject(projectId)
  return <ClientDocuments ctx={ctx} />
}
