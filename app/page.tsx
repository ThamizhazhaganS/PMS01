import { redirect } from "next/navigation"
import { getViewer } from "@/lib/data"
import { SessionEnded } from "@/components/shared/session-ended"

export default async function Home() {
  const u = await getViewer()
  if (!u) return <SessionEnded />
  if (u.kind === "admin") redirect("/admin")
  if (u.kind === "exec") redirect("/exec")
  if (u.kind === "director" || u.kind === "team") redirect("/w")
  redirect("/portal")
}
