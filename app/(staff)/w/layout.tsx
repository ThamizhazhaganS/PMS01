import { AppHeader } from "@/components/shared/app-header"
import { needsYou } from "@/lib/data"
import { requireUser } from "@/lib/page-ctx"

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["director", "team"])
  const count = needsYou(user).length
  return (
    <>
      <AppHeader
        user={user}
        sub="Morphoverse workspace"
        searchAction="/w/search"
        nav={[
          { href: "/w", label: "Projects" },
          { href: "/w/needs-me", label: "Needs me", count },
        ]}
      />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </>
  )
}
