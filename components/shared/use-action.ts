"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import type { Result } from "@/lib/actions"

/** Runs a server action, toasts the outcome, and reports success to `onOk`. */
export function useAction() {
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<Result>, onOk?: () => void) =>
    start(async () => {
      const r = await fn()
      if (r.ok) {
        if (r.message) toast.success(r.message)
        onOk?.()
      } else toast.error(r.error)
    })
  return { pending, run }
}
