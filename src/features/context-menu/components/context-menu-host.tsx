import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import { CheckIcon, ChevronRightIcon } from 'lucide-react'
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
      {IconComponent && <IconComponent className="mr-2 size-4" />}
      <span className="flex-1">{label}</span>
      {shortcut && <span className="ml-2 text-xs text-muted-foreground">{shortcut}</span>}
      {checked && <CheckIcon className="ml-2 size-4" />}
    </>
  )
}

function menuItemHasRichSubmenu(menuItem: ResolvedContextMenuItem): boolean {
  return (
    Boolean(menuItem.submenuContent) ||
    Boolean(menuItem.children?.some((child) => menuItemHasRichSubmenu(child)))
  )
}

function ContextMenuRichSubmenuItem({ menuItem }: { menuItem: ResolvedContextMenuItem }) {
  const IconComponent = menuItem.icon
  const [open, setOpen] = React.useState(false)

  const openPanel = () => {
    if (menuItem.disabled) return
    setOpen(true)
  }
  const closePanel = () => setOpen(false)
  const belongsToSubmenuInteraction = (container: HTMLElement, target: EventTarget | null) => {
    if (!(target instanceof Element)) return false
    return container.contains(target) || Boolean(target.closest('[data-slot="select-content"]'))
  }
  const closePanelAfterNestedPopupCheck = (container: HTMLElement, target: EventTarget | null) => {
    if (belongsToSubmenuInteraction(container, target)) return
    window.requestAnimationFrame(() => {
      if (document.querySelector('[data-slot="select-content"]')) return
      if (belongsToSubmenuInteraction(container, document.activeElement)) return
      closePanel()
    })
  }
  const closePanelWhenPointerLeaves = (event: React.PointerEvent<HTMLElement>) => {
    closePanelAfterNestedPopupCheck(event.currentTarget, event.relatedTarget)
  }
  const closePanelWhenMouseLeaves = (event: React.MouseEvent<HTMLElement>) => {
    closePanelAfterNestedPopupCheck(event.currentTarget, event.relatedTarget)
  }
  const closePanelWhenFocusLeaves = (event: React.FocusEvent<HTMLElement>) => {
    closePanelAfterNestedPopupCheck(event.currentTarget, event.relatedTarget)
  }

  return (
    <div
      className="relative"
      onPointerLeave={closePanelWhenPointerLeaves}
      onMouseLeave={closePanelWhenMouseLeaves}
      onBlur={closePanelWhenFocusLeaves}
    >
      <div
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        tabIndex={menuItem.disabled ? -1 : 0}
        data-slot="context-menu-sub-trigger"
        className={cn(
          "focus:bg-accent focus:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground gap-1.5 rounded-md px-1.5 py-1 text-sm [&_svg:not([class*='size-'])]:size-4 flex cursor-default items-center outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          menuItem.variant === 'danger' && 'text-destructive focus:text-destructive',
          menuItem.variant === 'share' && 'text-primary focus:text-primary',
          menuItem.className,
        )}
        data-open={open ? '' : undefined}
        aria-disabled={menuItem.disabled}
        onPointerEnter={openPanel}
        onMouseEnter={openPanel}
        onFocus={openPanel}
        onKeyDown={(event) => {
          if (menuItem.disabled) return
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            openPanel()
          }
          if (event.key === 'ArrowLeft' || event.key === 'Escape') {
            event.preventDefault()
            closePanel()
          }
        }}
      >
        <MenuItemContent
          IconComponent={IconComponent}
          checked={menuItem.checked}
          label={menuItem.label}
          shortcut={menuItem.shortcut}
        />
        <ChevronRightIcon className="ml-auto" />
      </div>
      {open && !menuItem.disabled && (
        <div
          role="presentation"
          data-slot="context-menu-rich-submenu-content"
          className="absolute left-full top-0 z-[9999] ml-1 min-w-36 rounded-lg bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
          onPointerEnter={openPanel}
          onMouseEnter={openPanel}
          onPointerLeave={closePanelWhenPointerLeaves}
          onMouseLeave={closePanelWhenMouseLeaves}
          onBlur={closePanelWhenFocusLeaves}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {menuItem.submenuContent}
        </div>
      )}
    </div>
  )
}

function ContextMenuResolvedItem({ menuItem, onAction }: ContextMenuResolvedItemProps) {
  const IconComponent = menuItem.icon

  if (menuItem.submenuContent) {
    return <ContextMenuRichSubmenuItem menuItem={menuItem} />
  }

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
    const hasRichSubmenu = menu.groups.some((group) =>
      group.items.some((menuItem) => menuItemHasRichSubmenu(menuItem)),
    )

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
              className={cn(menuClassName, hasRichSubmenu && 'overflow-visible')}
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
