import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { requireUser } from "@/lib/page-ctx"
import { projectFormOptions } from "@/lib/project-form-data"
import { NewProjectForm } from "@/components/shared/new-project-form"
import { PageTitle } from "@/components/shared/ui"

export default async function NewProject() {
  const user = await requireUser(["director"])
  return (
    <>
      <Link href="/w" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Projects</Link>
      <PageTitle eyebrow="New engagement" title="Create a project" />
      <NewProjectForm {...projectFormOptions()} ownerFixed={user.id} done="/w/projects/:id/plan" />
    </>
  )
}
