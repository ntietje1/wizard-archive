import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { buildMenu } from '../menu-builder'
import { useEditorMenuItems } from '../hooks/useEditorMenuItems'
import type { MenuContext, MenuItemDef } from '../types'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  ContextMenu as ShadcnContextMenu,
} from '~/components/shadcn/ui/context-menu'
import { cn } from '~/lib/shadcn/utils'

export interface ContextMenuRef {
  open: (position?: { x: number; y: number }) => void
  close: () => void
}

interface Props {
  buildContext: () => MenuContext | null
  onClose: () => void
  children: React.ReactNode
  className?: string
  menuClassName?: string
}

export const ContextMenu = forwardRef<ContextMenuRef, Props>(
  (
    {
      buildContext,
      onClose,
      children,
      className,
      menuClassName = 'w-48 z-[9999]',
    },
    ref,
  ) => {
    const { menuItems } = useEditorMenuItems()
    const [isOpen, setIsOpen] = useState(false)
    const [context, setContext] = useState<MenuContext | null>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLDivElement>(null)
    const actionInProgressRef = useRef(false)

    const builtMenu = context
      ? buildMenu(menuItems, context)
      : { isEmpty: true, groups: [] }

    useImperativeHandle(ref, () => ({
      open: (position?: { x: number; y: number }) => {
        const newContext = buildContext()
        if (!newContext) return
        setContext(newContext)

        const clientX =
          position?.x ?? triggerRef.current?.getBoundingClientRect().left ?? 0
        const clientY =
          position?.y ?? triggerRef.current?.getBoundingClientRect().bottom ?? 0

        if (triggerRef.current) {
          triggerRef.current.dispatchEvent(
            new MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
              clientX,
              clientY,
              button: 2,
            }),
          )
        }

        setIsOpen(true)
      },
      close: () => {
        setIsOpen(false)
        onClose()
      },
    }))

    const handleOpenChange = (open: boolean) => {
      setIsOpen(open)
      if (open && !context) {
        setContext(buildContext())
      } else if (!open) {
        setContext(null)
        onClose()
      }
    }

    const handleAction = async (item: MenuItemDef) => {
      if (actionInProgressRef.current || !context) return
      actionInProgressRef.current = true
      try {
        await item.action(context)
      } catch (error) {
        console.error('ContextMenu: Error executing action', error)
      } finally {
        actionInProgressRef.current = false
        setIsOpen(false)
        onClose()
      }
    }

    const renderMenuItem = (item: MenuItemDef) => {
      if (!context) return null

      const disabled = item.isDisabled?.(context) || false
      const checked = item.isChecked?.(context)
      const label =
        typeof item.label === 'function' ? item.label(context) : item.label
      const IconComponent = item.icon

      // Resolve children (can be static array or dynamic function)
      const menuChildren =
        typeof item.children === 'function'
          ? item.children(context)
          : item.children

      // If item has children, render as submenu
      if (menuChildren && menuChildren.length > 0) {
        return (
          <ContextMenuSub key={item.id}>
            <ContextMenuSubTrigger
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
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {menuChildren.map((child) => renderMenuItem(child))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )
      }

      // Regular menu item
      return (
        <ContextMenuItem
          key={item.id}
          variant={item.variant === 'danger' ? 'destructive' : 'default'}
          className={cn(item.className)}
          disabled={disabled}
          onSelect={async (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!disabled) await handleAction(item)
          }}
          onClick={async (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!disabled) await handleAction(item)
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
        </ContextMenuItem>
      )
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
          {!builtMenu.isEmpty && context && (
            <ContextMenuContent
              className={cn(menuClassName, 'z-[9999]')}
              side="bottom"
              align="start"
              sideOffset={4}
              data-no-dnd
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                e.nativeEvent.stopImmediatePropagation()
              }}
              onPointerDown={(e) => {
                if (e.button === 2) {
                  e.preventDefault()
                  e.stopPropagation()
                }
              }}
            >
              {builtMenu.groups.map((group, gi) => (
                <React.Fragment key={group.id}>
                  {gi > 0 && <ContextMenuSeparator />}
                  {group.items.map((item) => renderMenuItem(item))}
                </React.Fragment>
              ))}
            </ContextMenuContent>
          )}
        </ShadcnContextMenu>
      </div>
    )
  },
)
