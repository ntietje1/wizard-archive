import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { CheckIcon } from 'lucide-react'
import { groupConfig } from '../menu-registry'
import { useEditorContextMenu } from '../hooks/useEditorContextMenu'
import { EditorContextMenuProvider } from './editor-context-menu-provider'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { MenuItemDef, ViewContext } from '../types'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  ContextMenu as ShadcnContextMenu,
} from '~/features/shadcn/components/context-menu'
import { cn } from '~/features/shadcn/lib/utils'

export interface EditorContextMenuRef {
  open: (position?: { x: number; y: number }) => void
  close: () => void
}

interface Props {
  viewContext: ViewContext
  item?: AnySidebarItem
  isTrashView?: boolean
  children?: React.ReactNode
  className?: string
  menuClassName?: string
  onClose?: () => void
  onDialogOpen?: () => void
  onDialogClose?: () => void
}

const EditorMenuContent = forwardRef<
  EditorContextMenuRef,
  {
    children?: React.ReactNode
    className?: string
    menuClassName?: string
    onClose?: () => void
  }
>(({ children, className, menuClassName = 'w-48 z-[9999]', onClose }, ref) => {
  const { menuItems, menuContext } = useEditorContextMenu()

  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const actionInProgressRef = useRef(false)

  // Group menuItems
  const groupedMenu = (() => {
    if (menuItems.length === 0) {
      return {
        groups: [] as Array<{ id: string; items: Array<MenuItemDef> }>,
        isEmpty: true,
      }
    }

    const groupMap = menuItems.reduce((map, menuItem) => {
      const group = menuItem.group
      if (!map.has(group)) {
        map.set(group, [])
      }
      map.get(group)!.push(menuItem)
      return map
    }, new Map<string, Array<MenuItemDef>>())

    const sortedGroupIds = Array.from(groupMap.keys()).sort((a, b) => {
      const aConfig = groupConfig[a as keyof typeof groupConfig]
      const bConfig = groupConfig[b as keyof typeof groupConfig]
      const aPriority = aConfig?.priority ?? Number.MAX_SAFE_INTEGER
      const bPriority = bConfig?.priority ?? Number.MAX_SAFE_INTEGER
      return aPriority - bPriority
    })

    return {
      groups: sortedGroupIds.map((id) => ({
        id,
        items: groupMap.get(id)!,
      })),
      isEmpty: false,
    }
  })()

  useImperativeHandle(ref, () => ({
    open: (position?: { x: number; y: number }) => {
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
    if (!open) {
      onClose?.()
    }
  }

  const handleAction = async (menuItem: MenuItemDef) => {
    if (actionInProgressRef.current) return
    actionInProgressRef.current = true
    try {
      await menuItem.action(menuContext)
    } catch (error) {
      console.error('ContextMenu: Error executing action', error)
    }
    actionInProgressRef.current = false
    setIsOpen(false)
    onClose?.()
  }

  const renderMenuItem = (menuItem: MenuItemDef) => {
    const disabled = menuItem.isDisabled?.(menuContext) || false
    const checked = menuItem.isChecked?.(menuContext)
    const label =
      typeof menuItem.label === 'function'
        ? menuItem.label(menuContext)
        : menuItem.label
    const IconComponent = menuItem.icon

    // Resolve children (can be static array or dynamic function)
    const menuChildren =
      typeof menuItem.children === 'function'
        ? menuItem.children(menuContext)
        : menuItem.children

    // If item has children, render as submenu
    if (menuChildren && menuChildren.length > 0) {
      return (
        <ContextMenuSub key={menuItem.id}>
          <ContextMenuSubTrigger
            className={cn(
              menuItem.variant === 'danger' &&
                'text-destructive focus:text-destructive',
              menuItem.variant === 'share' && 'text-primary focus:text-primary',
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
        {!groupedMenu.isEmpty && (
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
            {groupedMenu.groups.map((group, gi) => (
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
})

EditorMenuContent.displayName = 'MenuContent'

export const EditorContextMenu = forwardRef<EditorContextMenuRef, Props>(
  (
    {
      viewContext,
      item,
      isTrashView,
      children,
      className,
      menuClassName = 'w-48 z-[9999]',
      onClose,
      onDialogOpen,
      onDialogClose,
    },
    ref,
  ) => {
    return (
      <EditorContextMenuProvider
        viewContext={viewContext}
        item={item}
        isTrashView={isTrashView}
        onDialogOpen={onDialogOpen}
        onDialogClose={onDialogClose}
      >
        <EditorMenuContent
          ref={ref}
          className={className}
          menuClassName={menuClassName}
          onClose={onClose}
        >
          {children}
        </EditorMenuContent>
      </EditorContextMenuProvider>
    )
  },
)
