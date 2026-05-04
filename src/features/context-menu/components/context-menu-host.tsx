import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { CheckIcon } from 'lucide-react'
import type { BuiltContextMenu, ResolvedContextMenuItem } from '../types'
import { handleError } from '~/shared/utils/logger'
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

interface ContextMenuResolvedItemProps {
  menuItem: ResolvedContextMenuItem
  onAction: (menuItem: ResolvedContextMenuItem) => Promise<void>
}

interface MenuItemContentProps {
  IconComponent: ResolvedContextMenuItem['icon']
  checked: boolean
  label: string
  shortcut?: string
}

function MenuItemContent({ IconComponent, checked, label, shortcut }: MenuItemContentProps) {
  return (
    <>
      {IconComponent && <IconComponent className="mr-2 h-4 w-4" />}
      <span className="flex-1">{label}</span>
      {shortcut && <span className="ml-2 text-xs text-muted-foreground">{shortcut}</span>}
      {checked && <CheckIcon className="ml-2 h-4 w-4" />}
    </>
  )
}

function ContextMenuResolvedItem({ menuItem, onAction }: ContextMenuResolvedItemProps) {
  const IconComponent = menuItem.icon

  if (menuItem.children && menuItem.children.length > 0) {
    return (
      <ContextMenuSub>
        <ContextMenuSubTrigger
          className={cn(
            menuItem.variant === 'danger' && 'text-destructive focus:text-destructive',
            menuItem.variant === 'share' && 'text-primary focus:text-primary',
            menuItem.className,
          )}
          disabled={menuItem.disabled}
        >
          <MenuItemContent
            IconComponent={IconComponent}
            checked={menuItem.checked}
            label={menuItem.label}
            shortcut={menuItem.shortcut}
          />
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {menuItem.children.map((child, index) => (
            <React.Fragment key={child.id}>
              {index > 0 && child.group !== menuItem.children?.[index - 1]?.group && (
                <ContextMenuSeparator />
              )}
              <ContextMenuResolvedItem menuItem={child} onAction={onAction} />
            </React.Fragment>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
    )
  }

  return (
    <ContextMenuItem
      variant={menuItem.variant === 'danger' ? 'destructive' : 'default'}
      className={cn(
        menuItem.variant === 'share' && 'text-primary focus:text-primary',
        menuItem.className,
      )}
      disabled={menuItem.disabled}
      onClick={async (event) => {
        event.preventDefault()
        event.stopPropagation()

        if (!menuItem.disabled) {
          await onAction(menuItem)
        }
      }}
    >
      <MenuItemContent
        IconComponent={IconComponent}
        checked={menuItem.checked}
        label={menuItem.label}
        shortcut={menuItem.shortcut}
      />
    </ContextMenuItem>
  )
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
                  {group.items.map((menuItem) => (
                    <ContextMenuResolvedItem
                      key={menuItem.id}
                      menuItem={menuItem}
                      onAction={handleAction}
                    />
                  ))}
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
