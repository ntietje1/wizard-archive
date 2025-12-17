import { forwardRef, useRef, useState } from 'react'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenu as ShadcnContextMenu,
} from '~/components/shadcn/ui/context-menu'
import { cn } from '~/lib/shadcn/utils'

export interface ContextMenuItemBase {
  className?: string
}

export interface ContextMenuAction extends ContextMenuItemBase {
  type: 'action'
  label: string
  icon?: React.ReactNode
  onClick: () => void
}

export interface ContextMenuDividerItem extends ContextMenuItemBase {
  type: 'divider'
}

export type ContextMenuItem = ContextMenuAction | ContextMenuDividerItem

interface ContextMenuProps {
  children: React.ReactNode
  items: Array<ContextMenuItem>
  className?: string
  menuClassName?: string
}

export interface ContextMenuRef {
  open: (position?: { x: number; y: number }) => void
  close: () => void
}

export const ContextMenu = forwardRef<ContextMenuRef, ContextMenuProps>(
  ({ children, items, className, menuClassName = 'w-48 z-[9999]' }, _ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      setIsOpen(true)
    }

    const handleOpenChange = (open: boolean) => {
      setIsOpen(open)
    }

    const handleItemClick = (onClick: () => void) => {
      onClick()
      setIsOpen(false)
    }

    return (
      <div
        ref={wrapperRef}
        className={cn('relative w-full', className)}
        onContextMenu={handleContextMenu}
      >
        <ShadcnContextMenu open={isOpen} onOpenChange={handleOpenChange}>
          <ContextMenuTrigger
            render={<div style={{ display: 'contents' }}>{children}</div>}
          />
          <ContextMenuContent
            className={cn(menuClassName, 'z-[9999]')}
            sideOffset={0}
            alignOffset={0}
            align="end"
          >
            {items.map((item, index) => {
              if (item.type === 'divider') {
                return <ContextMenuSeparator key={`divider-${index}`} />
              }
              // item.type === 'action'
              return (
                <ContextMenuItem
                  key={`action-${item.label}-${index}`}
                  onSelect={(e) => {
                    e.preventDefault()
                    handleItemClick(item.onClick)
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleItemClick(item.onClick)
                  }}
                  className={item.className}
                >
                  {item.icon && (
                    <span className="h-4 w-4 mr-2">{item.icon}</span>
                  )}
                  {item.label}
                </ContextMenuItem>
              )
            })}
          </ContextMenuContent>
        </ShadcnContextMenu>
      </div>
    )
  },
)
