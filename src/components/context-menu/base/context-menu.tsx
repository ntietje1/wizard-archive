import { useState, useRef, forwardRef, useImperativeHandle } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '~/components/shadcn/ui/dropdown-menu'
import { cn } from '~/lib/utils'

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
  items: ContextMenuItem[]
  className?: string
  menuClassName?: string
}

export interface ContextMenuRef {
  open: (position?: { x: number; y: number }) => void
  close: () => void
}

//TODO: switch to shadcn/ui/context-menu
export const ContextMenu = forwardRef<ContextMenuRef, ContextMenuProps>(
  ({ children, items, className, menuClassName = 'w-48 z-[9999]' }, ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const wrapperRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      open: (position?: { x: number; y: number }) => {
        if (position) {
          setPosition(position)
        } else {
          const rect = wrapperRef.current?.getBoundingClientRect()
          if (rect) {
            setPosition({
              x: rect.right,
              y: rect.bottom,
            })
          }
        }
        setIsOpen(true)
      },
      close: () => setIsOpen(false),
    }))

    const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const rect = wrapperRef.current?.getBoundingClientRect()
      if (rect) {
        setPosition({
          x: e.clientX + 4,
          y: e.clientY + 4,
        })
      }
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
        {children}
        <DropdownMenu
          open={isOpen}
          onOpenChange={handleOpenChange}
          modal={false}
        >
          <DropdownMenuContent
            className={cn(menuClassName, 'z-[9999]')}
            style={{
              position: 'absolute',
              top: position.y,
              left: position.x,
            }}
            sideOffset={0}
            alignOffset={0}
            align="end"
          >
            {items.map((item, index) =>
              item.type === 'divider' ? (
                <DropdownMenuSeparator key={`divider-${index}`} />
              ) : item.type === 'action' ? (
                <DropdownMenuItem
                  key={`action-${item.label}-${index}`}
                  onSelect={() => handleItemClick(item.onClick)}
                  className={item.className}
                >
                  {item.icon && (
                    <span className="h-4 w-4 mr-2">{item.icon}</span>
                  )}
                  {item.label}
                </DropdownMenuItem>
              ) : (
                <div key={`invalid-${index}`}>Invalid item type</div>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  },
)
