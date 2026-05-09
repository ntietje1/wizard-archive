import type { ComponentPropsWithRef, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '~/features/shadcn/lib/utils'
import {
  sidebarItemBackgroundClass,
  sidebarItemIconClass,
  sidebarItemNameClass,
} from '~/features/sidebar/utils/sidebar-item-visual-state'

interface SidebarRowProps extends ComponentPropsWithRef<'div'> {
  icon: LucideIcon
  label: string
  rightSlot?: ReactNode
  isActive?: boolean
}

export function SidebarRow({
  icon: Icon,
  label,
  rightSlot,
  isActive,
  className,
  ref,
  ...props
}: SidebarRowProps) {
  const visualState = { isSelected: false, isViewing: isActive === true, isMultiSelected: false }

  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center w-full h-8 px-1 rounded-sm group',
        sidebarItemBackgroundClass(visualState),
        className,
      )}
      {...props}
    >
      <div
        data-sidebar-row-icon
        className={cn(
          'size-6 shrink-0 flex items-center justify-center',
          sidebarItemIconClass(visualState),
        )}
      >
        <Icon className="size-4 shrink-0" />
      </div>
      <span className={cn('truncate ml-1 flex-1', sidebarItemNameClass(visualState))}>{label}</span>
      {rightSlot}
    </div>
  )
}
