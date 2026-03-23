import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import { XIcon } from 'lucide-react'
import { cn } from '~/features/shadcn/lib/utils'
import { buttonVariants } from '~/features/shadcn/components/button'
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
} from '~/features/shadcn/components/dialog'
import {
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogPortal,
} from '~/features/shadcn/components/alert-dialog'

/**
 * Dark backdrop rendered inside the dialog's portal
 */
function SettingsBackdrop() {
  return (
    <div className="fixed inset-0 z-50 bg-foreground/70 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in-0 duration-100" />
  )
}

export { Dialog as SettingsSubDialog }
export { AlertDialog as SettingsSubAlertDialog }

/**
 * Drop-in replacement for DialogContent that adds a dark backdrop
 */
export function SettingsSubDialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <SettingsBackdrop />
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          'bg-background data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 motion-reduce:transition-none motion-reduce:animate-none ring-foreground/10 grid max-w-[calc(100%-2rem)] gap-4 rounded-xl p-4 text-sm ring-1 duration-100 sm:max-w-sm fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 outline-none',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <button
                type="button"
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                  'absolute top-2 right-2',
                )}
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

/**
 * Drop-in replacement for AlertDialogContent that adds a dark backdrop.
 */
export function SettingsSubAlertDialogContent({
  className,
  size = 'default',
  ...props
}: AlertDialogPrimitive.Popup.Props & {
  size?: 'default' | 'sm'
}) {
  return (
    <AlertDialogPortal>
      <SettingsBackdrop />
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 motion-reduce:transition-none motion-reduce:animate-none bg-background ring-foreground/10 gap-4 rounded-xl p-4 ring-1 duration-100 data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 outline-none',
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}
