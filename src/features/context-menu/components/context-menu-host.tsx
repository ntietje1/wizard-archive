import React, { useImperativeHandle, useRef } from 'react'
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
  ref: React.Ref<ContextMenuHostRef>
  menu: BuiltContextMenu
  children?: React.ReactNode
  className?: string
  menuClassName?: string
  onClose?: () => void
}

interface ContextMenuResolvedItemProps {
  menuItem: ResolvedContextMenuItem
  onAction: (menuItem: ResolvedContextMenuItem) => Promise<void>
  activeSubmenuPath: ReadonlyArray<string>
  setActiveSubmenuPath: React.Dispatch<React.SetStateAction<Array<string>>>
  parentSubmenuPath: ReadonlyArray<string>
}

interface MenuItemContentProps {
  IconComponent: ResolvedContextMenuItem['icon']
  checked: boolean
  label: string
  content?: React.ReactNode
  shortcut?: string
}

type RichSubmenuSide = 'left' | 'right'

const RICH_SUBMENU_GAP_PX = 4
const RICH_SUBMENU_FALLBACK_WIDTH_PX = 300
const ROOT_SUBMENU_PATH: ReadonlyArray<string> = []

function submenuPathIsActive(
  submenuPath: ReadonlyArray<string>,
  activeSubmenuPath: ReadonlyArray<string>,
): boolean {
  if (activeSubmenuPath.length < submenuPath.length) return false
  for (let index = 0; index < submenuPath.length; index += 1) {
    if (activeSubmenuPath[index] !== submenuPath[index]) return false
  }
  return true
}

function getRichSubmenuSide(trigger: HTMLElement, content: HTMLElement): RichSubmenuSide {
  const triggerRect = trigger.getBoundingClientRect()
  const contentRect = content.getBoundingClientRect()
  const contentWidth = contentRect.width || content.offsetWidth || RICH_SUBMENU_FALLBACK_WIDTH_PX
  const rightSpace = window.innerWidth - triggerRect.right - RICH_SUBMENU_GAP_PX
  const leftSpace = triggerRect.left - RICH_SUBMENU_GAP_PX

  return rightSpace < contentWidth && leftSpace > rightSpace ? 'left' : 'right'
}

function MenuItemContent({
  IconComponent,
  checked,
  label,
  content,
  shortcut,
}: MenuItemContentProps) {
  if (content) {
    return (
      <>
        {content}
        {checked && <CheckIcon className="ml-2 size-4" />}
      </>
    )
  }

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

function ContextMenuRichSubmenuItem({
  menuItem,
  activeSubmenuPath,
  setActiveSubmenuPath,
  parentSubmenuPath,
}: {
  menuItem: ResolvedContextMenuItem
  activeSubmenuPath: ReadonlyArray<string>
  setActiveSubmenuPath: React.Dispatch<React.SetStateAction<Array<string>>>
  parentSubmenuPath: ReadonlyArray<string>
}) {
  const IconComponent = menuItem.icon
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [side, setSide] = React.useState<RichSubmenuSide>('right')
  const submenuPath = [...parentSubmenuPath, menuItem.id]
  const open = submenuPathIsActive(submenuPath, activeSubmenuPath)

  React.useLayoutEffect(() => {
    if (!open) return

    const updatePanelSide = () => {
      const trigger = triggerRef.current
      const content = contentRef.current
      if (!trigger || !content) return

      setSide(getRichSubmenuSide(trigger, content))
    }

    updatePanelSide()
    window.addEventListener('resize', updatePanelSide)

    const content = contentRef.current
    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && content) {
      resizeObserver = new ResizeObserver(updatePanelSide)
      resizeObserver.observe(content)
    }

    return () => {
      window.removeEventListener('resize', updatePanelSide)
      resizeObserver?.disconnect()
    }
  }, [open])

  const openPanel = () => {
    if (menuItem.disabled) return
    setActiveSubmenuPath(submenuPath)
  }
  const closePanel = () => {
    setActiveSubmenuPath((currentPath) =>
      submenuPathIsActive(submenuPath, currentPath) ? [...parentSubmenuPath] : currentPath,
    )
  }
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
      className="relative w-full"
      onPointerLeave={closePanelWhenPointerLeaves}
      onMouseLeave={closePanelWhenMouseLeaves}
      onBlur={closePanelWhenFocusLeaves}
    >
      <div
        ref={triggerRef}
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        tabIndex={menuItem.disabled ? -1 : 0}
        data-slot="context-menu-sub-trigger"
        className={cn(
          "focus:bg-accent focus:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground gap-1.5 rounded-md px-1.5 py-1 text-sm [&_svg:not([class*='size-'])]:size-4 flex w-full cursor-default items-center outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0",
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
          content={menuItem.content}
          shortcut={menuItem.shortcut}
        />
      </div>
      {open && !menuItem.disabled && (
        <div
          ref={contentRef}
          role="presentation"
          data-slot="context-menu-rich-submenu-content"
          className={cn(
            'absolute top-0 z-[9999] min-w-36 rounded-lg bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10',
            side === 'left' ? 'right-full mr-1' : 'left-full ml-1',
          )}
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

function ContextMenuResolvedItem({
  menuItem,
  onAction,
  activeSubmenuPath,
  setActiveSubmenuPath,
  parentSubmenuPath,
}: ContextMenuResolvedItemProps) {
  const IconComponent = menuItem.icon

  if (menuItem.submenuContent) {
    return (
      <ContextMenuRichSubmenuItem
        menuItem={menuItem}
        activeSubmenuPath={activeSubmenuPath}
        setActiveSubmenuPath={setActiveSubmenuPath}
        parentSubmenuPath={parentSubmenuPath}
      />
    )
  }

  if (menuItem.children && menuItem.children.length > 0) {
    const submenuPath = [...parentSubmenuPath, menuItem.id]
    const open = submenuPathIsActive(submenuPath, activeSubmenuPath)

    return (
      <ContextMenuSub
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setActiveSubmenuPath(submenuPath)
            return
          }

          setActiveSubmenuPath((currentPath) =>
            submenuPathIsActive(submenuPath, currentPath) ? [...parentSubmenuPath] : currentPath,
          )
        }}
      >
        <ContextMenuSubTrigger
          className={cn(
            menuItem.variant === 'danger' && 'text-destructive focus:text-destructive',
            menuItem.variant === 'share' && 'text-primary focus:text-primary',
            menuItem.className,
          )}
          disabled={menuItem.disabled}
          onPointerEnter={() => {
            if (!menuItem.disabled) {
              setActiveSubmenuPath(submenuPath)
            }
          }}
          onMouseEnter={() => {
            if (!menuItem.disabled) {
              setActiveSubmenuPath(submenuPath)
            }
          }}
        >
          <MenuItemContent
            IconComponent={IconComponent}
            checked={menuItem.checked}
            label={menuItem.label}
            content={menuItem.content}
            shortcut={menuItem.shortcut}
          />
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {menuItem.children.map((child, index) => (
            <React.Fragment key={child.id}>
              {index > 0 && child.group !== menuItem.children?.[index - 1]?.group && (
                <ContextMenuSeparator />
              )}
              <ContextMenuResolvedItem
                menuItem={child}
                onAction={onAction}
                activeSubmenuPath={activeSubmenuPath}
                setActiveSubmenuPath={setActiveSubmenuPath}
                parentSubmenuPath={submenuPath}
              />
            </React.Fragment>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
    )
  }

  return (
    <ContextMenuItem
      variant={menuItem.variant === 'danger' ? 'destructive' : 'default'}
      closeOnClick={menuItem.closeOnSelect !== false}
      className={cn(
        menuItem.variant === 'share' && 'text-primary focus:text-primary',
        menuItem.className,
      )}
      disabled={menuItem.disabled}
      aria-label={menuItem.content ? menuItem.label : undefined}
      onPointerEnter={() => setActiveSubmenuPath([...parentSubmenuPath])}
      onMouseEnter={() => setActiveSubmenuPath([...parentSubmenuPath])}
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
        content={menuItem.content}
        shortcut={menuItem.shortcut}
      />
    </ContextMenuItem>
  )
}

export function ContextMenuHost({
  ref,
  menu,
  children,
  className,
  menuClassName = 'w-48 z-[9999]',
  onClose,
}: ContextMenuHostProps) {
  const menuRef = useRef<ContextMenuRef>(null)
  const actionInProgressRef = useRef(false)
  const [activeSubmenuPath, setActiveSubmenuPath] = React.useState<Array<string>>([])
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
      if (menuItem.closeOnSelect !== false) {
        menuRef.current?.close()
      }
    }
  }

  return (
    <div className={cn('relative w-full', className)}>
      <ContextMenu
        ref={menuRef}
        onOpenChange={(open) => {
          if (!open) {
            setActiveSubmenuPath([])
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
                    activeSubmenuPath={activeSubmenuPath}
                    setActiveSubmenuPath={setActiveSubmenuPath}
                    parentSubmenuPath={ROOT_SUBMENU_PATH}
                  />
                ))}
              </React.Fragment>
            ))}
          </ContextMenuContent>
        ) : null}
      </ContextMenu>
    </div>
  )
}
