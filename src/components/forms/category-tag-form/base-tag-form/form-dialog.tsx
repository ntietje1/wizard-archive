import type { ReactNode } from 'react'
import type { LucideIcon } from '~/lib/icons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/shadcn/ui/dialog'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'

interface FormDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description: string
  icon: LucideIcon
  children: ReactNode
  width?: string
  closable?: boolean
}

export function FormDialog({
  isOpen,
  onClose,
  title,
  description,
  icon: Icon,
  children,
  width = 'max-w-2xl sm:max-w-2xl',
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
        className={`${width} max-h-[90vh] p-0 overflow-hidden`}
      >
        <ScrollArea className="max-h-[90vh] m-[1px] my-1">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-amber-600" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-6">{children}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
