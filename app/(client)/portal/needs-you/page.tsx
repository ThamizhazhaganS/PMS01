import { needsYou } from "@/lib/data"
import { requireUser } from "@/lib/page-ctx"
import { NeedsList } from "@/components/shared/needs-list"
import { PageTitle } from "@/components/shared/ui"

export default async function NeedsYouPage() {
  const user = await requireUser(["exec", "client_lead", "client_stakeholder"])
  return (
    <div className="max-w-3xl">
      <PageTitle eyebrow="Across your projects" title="Needs you">
        Approvals, questions and actions assigned to you — one button each.
      </PageTitle>
      <NeedsList items={needsYou(user)} showProject />
    </div>
  )
}
