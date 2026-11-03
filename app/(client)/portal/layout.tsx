import { AppHeader } from "@/components/shared/app-header"
import { needsYou } from "@/lib/data"
import { requireUser } from "@/lib/page-ctx"

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["exec", "client_lead", "client_stakeholder"])
  const count = needsYou(user).length
  const nav =
    user.kind === "exec"
      ? [
          { href: "/exec", label: "Portfolio" },
          { href: "/exec/attention", label: "Needs attention" },
          { href: "/portal/needs-you", label: "Needs you", count },
        ]
      : [
          { href: "/portal", label: "Home" },
          { href: "/portal/needs-you", label: "Needs you", count },
        ]
  return (
    <>
      <AppHeader user={user} sub="Nova Industries × Morphoverse" nav={nav} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </>
  )
}
