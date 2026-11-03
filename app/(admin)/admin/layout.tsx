import { AppHeader } from "@/components/shared/app-header"
import { requireUser } from "@/lib/page-ctx"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["admin"])
  return (
    <>
      <AppHeader user={user} sub="Platform administration" nav={[{ href: "/admin", label: "Organisations & users" }, { href: "/admin/security", label: "Security log" }]} />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </>
  )
}
