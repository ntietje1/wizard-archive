import type { ComponentProps } from 'react'
import { Toaster as SonnerToaster } from 'sonner'
import { cn } from '~/features/shadcn/lib/utils'

type ToasterProps = ComponentProps<typeof SonnerToaster>

export function Toaster({ className, toastOptions, ...props }: ToasterProps) {
  return (
    <SonnerToaster
      className={cn('toaster group', className)}
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            'group toast group-[.toaster]:border-border group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  )
}
