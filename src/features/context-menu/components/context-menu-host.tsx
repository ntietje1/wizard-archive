import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { CheckIcon } from 'lucide-react'
import type { BuiltContextMenu, ResolvedContextMenuItem } from '../types'
import { handleError, logger } from '~/shared/utils/logger'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '~/features/shadcn/components/context-menu'
import type { ContextMenuRef } from '~/features/shadcn/components/context-menu'
import { cn } from '~/features/shadcn/lib/utils'

export interface ContextMenuHostRef {
  open: (position: { x: number; y: number }) => void
  close: () => void
}

interface ContextMenuHostProps {
  menu: BuiltContextMenu
  children?: React.ReactNode
  className?: string
  menuClassName?: string
  onClose?: () => void
}

export const ContextMenuHost = forwardRef<ContextMenuHostRef, ContextMenuHostProps>(
  ({ menu, children, className, menuClassName = 'w-48 z-[9999]', onClose }, ref) => {
    const menuRef = useRef<ContextMenuRef>(null)
    const actionInProgressRef = useRef(false)

    useImperativeHandle(
      ref,
      () => ({
        open: (position) => {
          if (menu.isEmpty) {
            return
          }

          menuRef.current?.openAt(position)
        },
        close: () => {
          menuRef.current?.close()
        },
      }),
      [menu.isEmpty],
    )

    const handleAction = async (menuItem: ResolvedContextMenuItem) => {
      if (actionInProgressRef.current) {
        return
      }

      actionInProgressRef.current = true
      try {
        await menuItem.onSelect()
      } catch (error) {
        handleError(error, 'Menu action failed')
      } finally {
        actionInProgressRef.current = false
        menuRef.current?.close()
      }
    }

    const renderMenuItem = (menuItem: ResolvedContextMenuItem): React.ReactNode => {
      const IconComponent = menuItem.icon

      if (menuItem.children && menuItem.children.length > 0) {
        return (
          <ContextMenuSub key={menuItem.id}>
            <ContextMenuSubTrigger
              className={cn(
                menuItem.variant === 'danger' && 'text-destructive focus:text-destructive',
                menuItem.variant === 'share' && 'text-primary focus:text-primary',
                menuItem.className,
              )}
              disabled={menuItem.disabled}
            >
              {IconComponent && <IconComponent className="mr-2 h-4 w-4" />}
              <span className="flex-1">{menuItem.label}</span>
              {menuItem.shortcut && (
                <span className="ml-2 text-xs text-muted-foreground">{menuItem.shortcut}</span>
              )}
              {menuItem.checked && <CheckIcon className="ml-2 h-4 w-4" />}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {menuItem.children.map((child) => renderMenuItem(child))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )
      }

      return (
        <ContextMenuItem
          key={menuItem.id}
          variant={menuItem.variant === 'danger' ? 'destructive' : 'default'}
          className={cn(menuItem.className)}
          disabled={menuItem.disabled}
          onClick={async (event) => {
            event.preventDefault()
            event.stopPropagation()

            if (!menuItem.disabled) {
              await handleAction(menuItem)
            }
          }}
        >
          {IconComponent && <IconComponent className="mr-2 h-4 w-4" />}
          <span className="flex-1">{menuItem.label}</span>
          {menuItem.shortcut && (
            <span className="ml-2 text-xs text-muted-foreground">{menuItem.shortcut}</span>
          )}
          {menuItem.checked && <CheckIcon className="ml-2 h-4 w-4" />}
        </ContextMenuItem>
      )
    }

    return (
      <div className={cn('relative w-full', className)}>
        <ContextMenu
          ref={menuRef}
          onOpenChange={(open) => {
            if (!open) {
              onClose?.()
            }
          }}
        >
          {children ? (
            <ContextMenuTrigger render={<div style={{ display: 'contents' }}>{children}</div>} />
          ) : null}
          {!menu.isEmpty ? (
            <ContextMenuContent
              className={cn(menuClassName)}
              side="bottom"
              align="start"
              sideOffset={4}
              data-no-dnd
              onContextMenu={(event) => {
                event.preventDefault()
                event.stopPropagation()
                event.nativeEvent.stopImmediatePropagation?.()
              }}
            >
              {menu.groups.map((group, index) => (
                <React.Fragment key={group.id}>
                  {index > 0 && <ContextMenuSeparator />}
                  {group.items.map((menuItem) => renderMenuItem(menuItem))}
                </React.Fragment>
              ))}
            </ContextMenuContent>
          ) : null}
        </ContextMenu>
      </div>
    )
  },
)

ContextMenuHost.displayName = 'ContextMenuHost'
