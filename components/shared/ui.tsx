import { cn } from "@/lib/utils"

export function Section({ title, eyebrow, action, children, className }: { title?: React.ReactNode; eyebrow?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow mb-0.5">{eyebrow}</div>}
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

export function Empty({ title, hint, children }: { title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{hint}</p>}
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

export function Initials({ name, className }: { name: string; className?: string }) {
  const i = name.split(" ").map((p) => p[0]).slice(0, 2).join("")
  return (
    <span aria-hidden className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground", className)}>
      {i}
    </span>
  )
}

/** Label wraps the control so every input has an accessible name. Use as="div" for button groups. */
export function Field({ label, hint, children, as = "label" }: { label: string; hint?: string; children: React.ReactNode; as?: "label" | "div" }) {
  const Tag = as
  return (
    <Tag className="grid gap-1.5">
      <span className="text-xs font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Tag>
  )
}

export function PageTitle({ eyebrow, title, children, action }: { eyebrow?: string; title: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="display text-3xl leading-tight sm:text-4xl">{title}</h1>
        {children && <div className="mt-2 max-w-2xl text-sm text-muted-foreground">{children}</div>}
      </div>
      {action}
    </div>
  )
}
