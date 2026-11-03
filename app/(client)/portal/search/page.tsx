import { requireUser } from "@/lib/page-ctx"
import { SearchPage } from "@/components/shared/search-results"

export default async function ClientSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser(["exec", "client_lead", "client_stakeholder"])
  const { q = "" } = await searchParams
  return <SearchPage user={user} q={q} action="/portal/search" />
}
