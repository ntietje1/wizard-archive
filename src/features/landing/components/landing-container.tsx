import type { ComponentProps } from 'react'
import { cn } from '~/features/shadcn/lib/utils'

export function LandingContainer({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('mx-auto w-full max-w-[1200px] px-6 md:px-8', className)} {...props}>
      {children}
    </div>
  )
}
