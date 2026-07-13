import type { ComponentPropsWithRef, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import {
  sidebarItemBackgroundClass,
  sidebarItemIconClass,
  sidebarItemNameClass,
} from '../item-visual-state'

interface SidebarRowProps extends ComponentPropsWithRef<'div'> {
  icon: LucideIcon
  label: string
  rightSlot?: ReactNode
  isActive?: boolean
}

export function SidebarRow({
  ref,
  icon: Icon,
  label,
  rightSlot,
  isActive,
  className,
  onClick,
  onKeyDown,
  role: providedRole,
  tabIndex: providedTabIndex,
  ...props
}: SidebarRowProps) {
  const visualState = { isSelected: false, isViewing: isActive === true, isMultiSelected: false }
  const isInteractive = onClick !== undefined

  return (
    <div
      ref={ref}
      data-active={isActive === true ? 'true' : 'false'}
      className={cn(
        'flex items-center w-full h-8 px-1 rounded-sm group',
        sidebarItemBackgroundClass(visualState),
        className,
      )}
      onClick={onClick}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event)
        if (!isInteractive || event.defaultPrevented) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onClick?.(event as unknown as MouseEvent<HTMLDivElement>)
      }}
      role={isInteractive ? 'button' : providedRole}
      tabIndex={isInteractive ? (providedTabIndex ?? 0) : providedTabIndex}
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
      <span className={cn('truncate ml-1 flex-1', sidebarItemNameClass(visualState))} title={label}>
        {label}
      </span>
      {rightSlot}
    </div>
  )
}
