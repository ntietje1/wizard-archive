import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { buildMenu } from '../menu-builder'
import {
  useBuildMenuContext,
  useEditorMenuItems,
} from '../hooks/useEditorContextMenu'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { MenuContext, MenuItemDef, ViewContext } from '../types'
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
import { CheckIcon } from '~/lib/icons'

export interface EditorContextMenuRef {
  open: (position?: { x: number; y: number }) => void
  close: () => void
}

interface Props {
  viewContext: ViewContext
  item?: AnySidebarItem
  children: React.ReactNode
  className?: string
  menuClassName?: string
  // Optional custom onClose handler
  onClose?: () => void
}

export const EditorContextMenu = forwardRef<EditorContextMenuRef, Props>(
  (
    {
      viewContext,
      item,
      children,
      className,
      menuClassName = 'w-48 z-[9999]',
      onClose,
    },
    ref,
  ) => {
    const { menuItems } = useEditorMenuItems()
    const buildContext = useBuildMenuContext({ viewContext, item })
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
        const newContext = buildContext(item)
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
        onClose?.()
      },
    }))

    const handleOpenChange = (open: boolean) => {
      setIsOpen(open)
      if (open && !context) {
        setContext(buildContext(item))
      } else if (!open) {
        setContext(null)
        onClose?.()
      }
    }

    const handleAction = async (menuItem: MenuItemDef) => {
      if (actionInProgressRef.current || !context) return
      actionInProgressRef.current = true
      try {
        await menuItem.action(context)
      } catch (error) {
        console.error('ContextMenu: Error executing action', error)
      } finally {
        actionInProgressRef.current = false
        setIsOpen(false)
        onClose?.()
      }
    }

    const renderMenuItem = (menuItem: MenuItemDef) => {
      if (!context) return null

      const disabled = menuItem.isDisabled?.(context) || false
      const checked = menuItem.isChecked?.(context)
      const label =
        typeof menuItem.label === 'function'
          ? menuItem.label(context)
          : menuItem.label
      const IconComponent = menuItem.icon

      // Resolve children (can be static array or dynamic function)
      const menuChildren =
        typeof menuItem.children === 'function'
          ? menuItem.children(context)
          : menuItem.children

      // If item has children, render as submenu
      if (menuChildren && menuChildren.length > 0) {
        return (
          <ContextMenuSub key={menuItem.id}>
            <ContextMenuSubTrigger
              className={cn(
                menuItem.variant === 'danger' &&
                  'text-red-600 focus:text-red-600',
                menuItem.variant === 'share' &&
                  'text-amber-600 focus:text-amber-600',
                menuItem.className,
              )}
              disabled={disabled}
            >
              {IconComponent && <IconComponent className="h-4 w-4 mr-2" />}
              <span className="flex-1">{label}</span>
              {menuItem.shortcut && (
                <span className="text-xs text-muted-foreground ml-2">
                  {menuItem.shortcut}
                </span>
              )}
              {checked && <CheckIcon className="ml-2 h-4 w-4" />}
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
          key={menuItem.id}
          variant={menuItem.variant === 'danger' ? 'destructive' : 'default'}
          className={cn(menuItem.className)}
          disabled={disabled}
          onSelect={async (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!disabled) await handleAction(menuItem)
          }}
          onClick={async (e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!disabled) await handleAction(menuItem)
          }}
        >
          {IconComponent && <IconComponent className="h-4 w-4 mr-2" />}
          <span className="flex-1">{label}</span>
          {menuItem.shortcut && (
            <span className="text-xs text-muted-foreground ml-2">
              {menuItem.shortcut}
            </span>
          )}
          {checked && <CheckIcon className="ml-2 h-4 w-4" />}
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
                  {group.items.map((menuItem) => renderMenuItem(menuItem))}
                </React.Fragment>
              ))}
            </ContextMenuContent>
          )}
        </ShadcnContextMenu>
      </div>
    )
  },
)
