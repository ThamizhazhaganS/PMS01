import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { requireUser } from "@/lib/page-ctx"
import { projectFormOptions } from "@/lib/project-form-data"
import { NewProjectForm } from "@/components/shared/new-project-form"
import { PageTitle } from "@/components/shared/ui"

export default async function AdminNewProject() {
  await requireUser(["admin"])
  return (
    <>
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Organisations & users</Link>
      <PageTitle eyebrow="Platform" title="Create a project">
        You set up the shell and the owner. You will not get access to its content.
      </PageTitle>
      <NewProjectForm {...projectFormOptions()} done="/admin" />
    </>
  )
}
