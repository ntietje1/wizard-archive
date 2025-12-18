import React, { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { MenuContext, MenuItemDef } from '../types'
import { buildMenu } from '../menu-builder'
import { getCategoryIcon } from '~/lib/category-icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '~/components/shadcn/ui/dropdown-menu'
import { cn } from '~/lib/utils'
import { useMenuItems } from './ContextMenuProvider'

export interface ContextMenuItem {
  type: 'action' | 'divider'
  label: string
  icon?: ReactNode
  onClick: () => void
  className?: string
}

interface Props {
  x: number
  y: number
  context: MenuContext
  onClose: () => void
  menuClassName?: string
}

export function ContextMenu({
  x,
  y,
  context,
  onClose,
  menuClassName = 'w-48 z-[9999]',
}: Props) {
  const { menuItems } = useMenuItems()
  const menuRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = React.useState(true)

  const builtMenu = buildMenu(menuItems, context)

  // Adjust position to keep menu in viewport
  const [position, setPosition] = React.useState({ x, y })

  useEffect(() => {
    if (!menuRef.current) return

    const rect = menuRef.current.getBoundingClientRect()
    const newX =
      x + rect.width > window.innerWidth
        ? window.innerWidth - rect.width - 8
        : x
    const newY =
      y + rect.height > window.innerHeight
        ? window.innerHeight - rect.height - 8
        : y

    setPosition({ x: newX, y: newY })
  }, [x, y])

  if (builtMenu.isEmpty) return null

  const handleAction = async (item: MenuItemDef) => {
    // Execute the action first
    await item.action(context)
    // Then close the menu
    setIsOpen(false)
    onClose()
  }

  const renderMenuItem = (item: MenuItemDef) => {
    const disabled = item.isDisabled?.(context) || false
    const checked = item.isChecked?.(context)
    const label =
      typeof item.label === 'function' ? item.label(context) : item.label
    // Use category icon for create-tag items if available, otherwise use item icon
    const IconComponent =
      item.id === 'submenu-create-tag' && context.category?.iconName
        ? getCategoryIcon(context.category.iconName)
        : item.icon

    // If item has children, render as submenu
    if (item.children && item.children.length > 0) {
      return (
        <DropdownMenuSub key={item.id}>
          <DropdownMenuSubTrigger
            className={cn(
              item.variant === 'danger' && 'text-red-600 focus:text-red-600',
              item.className,
            )}
            disabled={disabled}
          >
            {IconComponent && <IconComponent className="h-4 w-4 mr-2" />}
            <span className="flex-1">{label}</span>
            {item.shortcut && (
              <span className="text-xs text-muted-foreground ml-2">
                {item.shortcut}
              </span>
            )}
            {checked !== undefined && (
              <span className="ml-2">{checked ? '✓' : ''}</span>
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {item.children.map((child) => renderMenuItem(child))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )
    }

    // Regular menu item
    return (
      <DropdownMenuItem
        key={item.id}
        className={cn(
          item.variant === 'danger' && 'text-red-600 focus:text-red-600',
          item.className,
        )}
        disabled={disabled}
        onSelect={async (e) => {
          // Prevent default close behavior
          e.preventDefault()
          if (!disabled) {
            // Execute action, then close
            await handleAction(item)
          }
        }}
        onClick={(e) => {
          // Also prevent click from bubbling
          e.stopPropagation()
        }}
      >
        {IconComponent && <IconComponent className="h-4 w-4 mr-2" />}
        <span className="flex-1">{label}</span>
        {item.shortcut && (
          <span className="text-xs text-muted-foreground ml-2">
            {item.shortcut}
          </span>
        )}
        {checked !== undefined && (
          <span className="ml-2">{checked ? '✓' : ''}</span>
        )}
      </DropdownMenuItem>
    )
  }

  const menuContent = (
    <div
      ref={menuRef}
      data-context-menu
      style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none' }}
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open)
          if (!open) {
            onClose()
          }
        }}
        modal={false}
      >
        <DropdownMenuContent
          data-context-menu
          className={cn(menuClassName, 'z-[9999]')}
          style={{
            position: 'fixed',
            top: position.y,
            left: position.x,
            pointerEvents: 'auto',
          }}
          sideOffset={0}
          alignOffset={0}
          align="end"
        >
          {builtMenu.groups.map((group, gi) => (
            <React.Fragment key={group.id}>
              {gi > 0 && <DropdownMenuSeparator />}
              {group.items.map((item) => renderMenuItem(item))}
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  // Render via portal to avoid affecting layout
  return createPortal(menuContent, document.body)
}
