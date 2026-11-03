import { requireUser } from "@/lib/page-ctx"
import { SearchPage } from "@/components/shared/search-results"

export default async function StaffSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser(["director", "team"])
  const { q = "" } = await searchParams
  return <SearchPage user={user} q={q} action="/w/search" />
}
