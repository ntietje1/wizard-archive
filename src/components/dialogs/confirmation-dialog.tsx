import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/shadcn/ui/dialog'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import { Button } from '~/components/shadcn/ui/button'
import { Loader2 } from '~/lib/icons'

interface ConfirmationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: ReactNode
  confirmLabel?: string
  confirmVariant?: 'default' | 'destructive'
  children?: ReactNode
  isLoading?: boolean
  disabled?: boolean
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'destructive',
  children,
  isLoading = false,
  disabled = false,
}: ConfirmationDialogProps) {
  const handleConfirm = () => {
    if (!disabled && !isLoading) {
      onConfirm()
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-w-md max-h-[90vh] p-0 overflow-hidden flex flex-col"
        showCloseButton={!isLoading}
      >
        <ScrollArea className="flex-1 max-h-[calc(90vh-80px)]">
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold text-foreground mb-4 break-words">
                {title}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm leading-relaxed break-words">
                {description}
              </DialogDescription>
            </div>
          </DialogHeader>

          {children && (
            <div className="px-6 pb-4">
              <div className="text-sm text-muted-foreground">{children}</div>
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-3 px-6 py-4 border-t bg-muted/30">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 min-w-0"
          >
            <span className="truncate">Cancel</span>
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={disabled || isLoading}
            className="flex-1 min-w-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Processing...</span>
              </>
            ) : (
              <span className="truncate">{confirmLabel}</span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
