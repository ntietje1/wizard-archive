import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
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
  open: (event?: MouseEvent) => void
  close: () => void
}

export const ContextMenu = forwardRef<ContextMenuRef, ContextMenuProps>(
  ({ children, items, className, menuClassName = 'w-48 z-[9999]' }, ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      open: (event?: MouseEvent) => {
        let clientX: number
        let clientY: number

        if (event) {
          clientX = event.clientX
          clientY = event.clientY
        } else if (triggerRef.current) {
          // Use button's bottom-left corner as fallback
          const rect = triggerRef.current.getBoundingClientRect()
          clientX = rect.left
          clientY = rect.bottom
        } else {
          // Last resort - use wrapper's position
          const rect = wrapperRef.current?.getBoundingClientRect()
          if (rect) {
            clientX = rect.left
            clientY = rect.bottom
          } else {
            clientX = 0
            clientY = 0
          }
        }

        // Trigger synthetic contextmenu event
        if (triggerRef.current) {
          const syntheticEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY,
            button: 2,
          })
          triggerRef.current.dispatchEvent(syntheticEvent)
        }

        setIsOpen(true)
      },
      close: () => {
        setIsOpen(false)
      },
    }))

    const handleOpenChange = (open: boolean) => {
      setIsOpen(open)
    }

    const handleItemClick = (onClick: () => void) => {
      onClick()
      setIsOpen(false)
    }

    const renderMenuItems = () => {
      return items.map((item, index) => {
        if (item.type === 'divider') {
          return <ContextMenuSeparator key={`divider-${index}`} />
        }
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
            {item.icon && <span className="h-4 w-4 mr-2">{item.icon}</span>}
            {item.label}
          </ContextMenuItem>
        )
      })
    }

    return (
      <div ref={wrapperRef} className={cn('relative w-full', className)}>
        <ShadcnContextMenu open={isOpen} onOpenChange={handleOpenChange}>
          <ContextMenuTrigger
            render={
              <div ref={triggerRef} style={{ display: 'contents' }}>
                {children}
              </div>
            }
          />
          <ContextMenuContent
            className={cn(menuClassName, 'z-[9999]')}
            side="bottom"
            align="start"
            sideOffset={4}
          >
            {renderMenuItems()}
          </ContextMenuContent>
        </ShadcnContextMenu>
      </div>
    )
  },
)
