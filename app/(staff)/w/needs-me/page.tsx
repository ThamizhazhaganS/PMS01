import { needsYou } from "@/lib/data"
import { requireUser } from "@/lib/page-ctx"
import { NeedsList } from "@/components/shared/needs-list"
import { PageTitle } from "@/components/shared/ui"

export default async function NeedsMe() {
  const user = await requireUser(["director", "team"])
  return (
    <div className="max-w-3xl">
      <PageTitle eyebrow="Across your engagements" title="Needs me">
        Actions assigned to you and anything awaiting your response.
      </PageTitle>
      <NeedsList items={needsYou(user)} showProject />
    </div>
  )
}
