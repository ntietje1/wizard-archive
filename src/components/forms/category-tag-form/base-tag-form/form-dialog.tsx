import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '~/components/shadcn/ui/dialog'
import { type LucideIcon } from '~/lib/icons'

interface FormDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description: string
  icon: LucideIcon
  children: ReactNode
  maxWidth?: string
  closable?: boolean
}

export function FormDialog({
  isOpen,
  onClose,
  title,
  description,
  icon: Icon,
  children,
  maxWidth = 'max-w-md',
  closable = true,
}: FormDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && closable) {
          onClose()
        }
      }}
    >
      <DialogContent
        showCloseButton={closable}
        className={`${maxWidth} max-h-[90vh] overflow-y-auto`}
        onEscapeKeyDown={(event) => {
          if (!closable) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        onPointerDownOutside={(event) => {
          if (!closable) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-amber-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="px-1">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
