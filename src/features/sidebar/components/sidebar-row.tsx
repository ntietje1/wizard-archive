import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '~/features/shadcn/lib/utils'

interface SidebarRowProps extends React.ComponentPropsWithoutRef<'div'> {
  icon: LucideIcon
  label: string
  rightSlot?: React.ReactNode
  isActive?: boolean
}

export const SidebarRow = forwardRef<HTMLDivElement, SidebarRowProps>(
  function SidebarRow(
    { icon: Icon, label, rightSlot, isActive, className, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center w-full h-8 px-1 rounded-sm group',
          isActive && 'bg-muted',
          !isActive && 'hover:bg-muted/70',
          className,
        )}
        {...props}
      >
        <div className="h-6 w-6 shrink-0 flex items-center justify-center text-muted-foreground">
          <Icon className="h-4 w-4 shrink-0" />
        </div>
        <span className="truncate ml-1 flex-1">{label}</span>
        {rightSlot}
      </div>
    )
  },
)
