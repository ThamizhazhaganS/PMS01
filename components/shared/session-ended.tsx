import { ShieldOff } from "lucide-react"

/** Shown when the signed-in account was deactivated: the next request is refused (NFR-08). */
export function SessionEnded() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <ShieldOff className="size-10 text-bad" aria-hidden />
      <h1 className="display mt-4 text-3xl">Your session has ended</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This account is no longer active. All sessions and signed links were invalidated. Use the dev switcher above to choose another user.
      </p>
    </main>
  )
}
