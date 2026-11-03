import Link from "next/link"
import { Plus } from "lucide-react"
import { needsYou, orgById } from "@/lib/data"
import { attentionFor } from "@/lib/attention"
import { portfolioByOrg } from "@/lib/portfolio"
import { requireUser } from "@/lib/page-ctx"
import { NeedsList } from "@/components/shared/needs-list"
import { Empty, PageTitle, Section } from "@/components/shared/ui"
import { AttentionList, KpiRow, OrgCard } from "@/components/staff/dashboard"
import { buttonVariants } from "@/components/ui/button"

/** Morphoverse home: dashboard first, then organisations → projects. */
export default async function Dashboard() {
  const user = await requireUser(["director", "team"])
  const { orgs, totals } = portfolioByOrg(user)
  const attention = attentionFor(user)
  const needs = needsYou(user)
  const orgName = (id: string) => orgById(id)?.name ?? ""

  return (
    <>
      <PageTitle
        eyebrow="Morphoverse · Dashboard"
        title={<>Good to see you, <em>{user.name.split(" ")[0]}</em>.</>}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/w/projects" className={buttonVariants({ variant: "outline" })}>All projects</Link>
            {user.kind === "director" && <Link href="/w/new" className={buttonVariants()}><Plus /> New project</Link>}
          </div>
        }
      >
        Across the {orgs.length} client organisation{orgs.length === 1 ? "" : "s"} and {totals.projects} project{totals.projects === 1 ? "" : "s"} you are part of.
      </PageTitle>

      {orgs.length === 0 ? (
        <Empty title="No engagements yet" hint="A Director adds you to a project when you join its team." />
      ) : (
        <div className="space-y-6">
          <KpiRow t={totals} showMoney />

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="lg:col-span-2" aria-labelledby="orgs-h">
              <h2 id="orgs-h" className="mb-3 text-sm font-semibold">Organisations</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {orgs.map(({ org, rows, totals: t }) => (
                  <OrgCard key={org.id} org={org} t={t} href={`/w/orgs/${org.id}`} projectNames={rows.map((r) => r.project.name)} />
                ))}
              </div>
            </section>
            <div className="space-y-6">
              <Section title={`Needs attention (${attention.length})`}>
                <AttentionList items={attention} orgName={orgName} />
              </Section>
              <Section title={`Needs me (${needs.length})`}>
                <NeedsList items={needs.slice(0, 4)} showProject />
                {needs.length > 4 && <Link href="/w/needs-me" className="mt-2 inline-block text-xs text-brand hover:underline">See all {needs.length}</Link>}
              </Section>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
