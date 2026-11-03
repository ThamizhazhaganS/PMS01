import { AppHeader } from "@/components/shared/app-header"
import { needsYou, orgById } from "@/lib/data"
import { requireUser } from "@/lib/page-ctx"

export default async function ExecLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["exec"])
  return (
    <>
      <AppHeader
        user={user}
        sub={`${orgById(user.orgId)?.name} · Executive oversight`}
        searchAction="/portal/search"
        nav={[
          { href: "/exec", label: "Portfolio" },
          { href: "/exec/attention", label: "Needs attention" },
          { href: "/portal/needs-you", label: "Needs you", count: needsYou(user).length },
        ]}
      />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </>
  )
}
