"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import type { VariantProps } from "class-variance-authority"
import type { Result } from "@/lib/actions"
import { useAction } from "./use-action"
import { Field } from "./ui"

type BtnVariant = VariantProps<typeof buttonVariants>["variant"]
type BtnSize = VariantProps<typeof buttonVariants>["size"]

/** A dialog that requires a written reason before the action is sent. */
export function ReasonDialog({
  trigger,
  title,
  description,
  label = "Reason",
  placeholder,
  confirm = "Confirm",
  variant = "outline",
  size = "sm",
  confirmVariant = "default",
  minLength = 10,
  onSubmit,
}: {
  trigger: React.ReactNode
  title: string
  description?: React.ReactNode
  label?: string
  placeholder?: string
  confirm?: string
  variant?: BtnVariant
  size?: BtnSize
  confirmVariant?: BtnVariant
  minLength?: number
  onSubmit: (reason: string) => Promise<Result>
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const { pending, run } = useAction()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} size={size} />}>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Field label={label} hint={minLength ? `Required · at least ${minLength} characters` : undefined}>
          <textarea className="field" rows={3} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            disabled={pending || text.trim().length < minLength}
            onClick={() =>
              run(() => onSubmit(text), () => {
                setOpen(false)
                setText("")
              })
            }
          >
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** One-click action button with pending state + toast. */
export function ActionButton({
  children,
  onRun,
  variant = "outline",
  size = "sm",
  className,
  disabled,
}: {
  children: React.ReactNode
  onRun: () => Promise<Result>
  variant?: BtnVariant
  size?: BtnSize
  className?: string
  disabled?: boolean
}) {
  const { pending, run } = useAction()
  return (
    <Button variant={variant} size={size} className={className} disabled={pending || disabled} onClick={() => run(onRun)}>
      {children}
    </Button>
  )
}
