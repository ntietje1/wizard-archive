import { Check, ChevronRight } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function WorkspaceMenu({
  children,
  label,
  onClose,
  x,
  y,
}: {
  children: ReactNode
  label: string
  onClose: () => void
  x: number
  y: number
}) {
  const menu = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = menu.current
    if (!element) return
    const bounds = element.getBoundingClientRect()
    element.style.left = `${Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8))}px`
    element.style.top = `${Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8))}px`
  })
  useEffect(() => {
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    const close = (event: PointerEvent) => {
      const target = event.target as Element
      if (
        !menu.current?.contains(target) &&
        !target.closest('[data-workspace-submenu],[data-resource-appearance]')
      ) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [onClose])
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={label}
      className="fixed z-[70] max-h-[calc(100vh-16px)] w-56 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
      style={{ left: x, top: y }}
      onKeyDown={(event) => navigateWorkspaceMenu(event, onClose)}
    >
      {children}
    </div>,
    document.body,
  )
}

export function WorkspaceMenuItem({
  busy = false,
  checked = false,
  danger = false,
  disabled = false,
  icon,
  label,
  onActivate,
  shortcut,
}: {
  busy?: boolean
  checked?: boolean
  danger?: boolean
  disabled?: boolean
  icon: ReactNode
  label: string
  onActivate?: () => void
  shortcut?: string
}) {
  return (
    <button
      role="menuitem"
      type="button"
      aria-label={label}
      aria-busy={busy}
      aria-current={checked ? 'true' : undefined}
      disabled={disabled}
      className={`flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm outline-none hover:bg-muted focus:bg-muted disabled:pointer-events-none disabled:opacity-50 ${danger ? 'text-destructive' : ''}`}
      onClick={onActivate}
    >
      <span className="[&>svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shortcut && <span className="text-xs text-muted-foreground">{shortcut}</span>}
      {checked && <Check className="size-4" aria-hidden="true" />}
    </button>
  )
}

export function WorkspaceMenuSeparator() {
  return <hr className="my-1 border-0 border-t border-border" />
}

export function WorkspaceMenuSubmenu({
  children,
  icon,
  label,
  menuLabel = label,
  side,
}: {
  children: ReactNode
  icon: ReactNode
  label: string
  menuLabel?: string
  side: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const submenu = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!open || !trigger.current || !submenu.current) return
    const triggerBounds = trigger.current.getBoundingClientRect()
    const submenuBounds = submenu.current.getBoundingClientRect()
    const preferredLeft =
      side === 'left' ? triggerBounds.left - submenuBounds.width - 4 : triggerBounds.right + 4
    submenu.current.style.left = `${Math.max(
      8,
      Math.min(preferredLeft, window.innerWidth - submenuBounds.width - 8),
    )}px`
    submenu.current.style.top = `${Math.max(
      8,
      Math.min(triggerBounds.top, window.innerHeight - submenuBounds.height - 8),
    )}px`
  }, [open, side])
  return (
    <div className="relative" onPointerEnter={() => setOpen(true)}>
      <button
        ref={trigger}
        role="menuitem"
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm outline-none hover:bg-muted focus:bg-muted"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="[&>svg]:size-4">{icon}</span>
        <span className="min-w-0 flex-1">{label}</span>
        <ChevronRight className={`size-4 ${side === 'left' ? 'rotate-180' : ''}`} />
      </button>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={submenu}
            role="menu"
            aria-label={menuLabel}
            data-workspace-submenu
            className="fixed z-[80] w-44 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  )
}

function navigateWorkspaceMenu(event: KeyboardEvent<HTMLDivElement>, onClose: () => void) {
  if (event.key === 'Escape' || event.key === 'Tab') {
    onClose()
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
  ]
  if (items.length === 0) return
  const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)
  const nextIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[nextIndex]?.focus()
}
