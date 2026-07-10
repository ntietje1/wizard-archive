import type { ComponentProps } from 'react'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-muted rounded-md animate-pulse', className)}
      {...props}
    />
  )
}

export { Skeleton }
