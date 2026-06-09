import { SideMenuExtension } from '@blocknote/core/extensions'
import { useComponentsContext, useExtension, useExtensionState } from '@blocknote/react'
import {
  ChevronRight,
  Copy,
  Files,
  GripVertical,
  MessageSquare,
  Palette,
  Trash2,
  Type,
} from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import type { BlockNoteId } from 'shared/editor-blocks/types'
import type { NoteWithContent } from 'shared/notes/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/features/shadcn/components/tooltip'
import { openEditorBlockContextMenuFromEvent } from '~/features/editor/utils/open-editor-block-context-menu-from-event'
import { cn } from '~/features/shadcn/lib/utils'
import { useFloatingMenuDismiss } from '~/shared/hooks/use-floating-menu-dismiss'
import {
  clearInternalNativeDrag,
  markInternalNativeDrag,
} from '~/features/dnd/utils/internal-native-drag'

const MENU_WIDTH = 192
const MENU_GUTTER = 4

type MenuAnchor = {
  left: number
  top: number
  height: number
}

type MenuState = { anchor: MenuAnchor } | null

export function BlockDragHandleButton({ note }: { note: NoteWithContent }) {
  const Components = useComponentsContext()!
  const sideMenu = useExtension(SideMenuExtension)
  const [menuState, setMenuState] = useState<MenuState>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const didDragRef = useRef(false)
  const isMenuOpen = menuState !== null
  const block = useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block,
  })

  useLayoutEffect(() => {
    if (!isMenuOpen) return

    sideMenu.freezeMenu()
    return () => {
      sideMenu.unfreezeMenu()
    }
  }, [isMenuOpen, sideMenu])

  useFloatingMenuDismiss({
    enabled: isMenuOpen,
    menuRef,
    onDismiss: () => setMenuState(null),
  })

  if (!block) return null
  const activeBlock = block

  function handleContextMenu(e: React.MouseEvent<HTMLElement>) {
    openEditorBlockContextMenuFromEvent({
      event: e,
      note,
      blockNoteId: activeBlock.id as BlockNoteId,
    })
  }

  function handlePointerUpCapture(e: React.PointerEvent<HTMLElement>) {
    if (e.button !== 0) return
    if (didDragRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuState({
      anchor: {
        left: rect.left,
        top: rect.top,
        height: rect.height,
      },
    })
  }

  function handleDragStart(event: React.DragEvent) {
    didDragRef.current = true
    markInternalNativeDrag(event.dataTransfer)
    sideMenu.blockDragStart(event, activeBlock)
  }

  function handleDragEnd() {
    sideMenu.blockDragEnd()
    clearInternalNativeDrag()
    window.setTimeout(() => {
      didDragRef.current = false
    }, 0)
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={(triggerProps) => (
          <span
            {...triggerProps}
            className="inline-flex size-6 pr-3"
            role="presentation"
            onContextMenu={handleContextMenu}
            onPointerDownCapture={stopLeftPointerDownPropagation}
            onPointerUpCapture={handlePointerUpCapture}
          >
            <Components.SideMenu.Button
              label="Drag block"
              draggable={true}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              className="block-drag-handle-button cursor-grab active:cursor-grabbing"
              icon={<GripVertical size={18} />}
              data-testid="block-drag-handle-button"
            />
          </span>
        )}
      />
      {menuState &&
        typeof document !== 'undefined' &&
        createPortal(
          <BlockDragHandleMenu anchor={menuState.anchor} menuRef={menuRef} />,
          document.body,
        )}
      <TooltipContent side="bottom" className="whitespace-pre-line">
        <span className="block">
          <em>Drag</em> to move
        </span>
        <span className="block">
          <em>Click</em> to open menu
        </span>
      </TooltipContent>
    </Tooltip>
  )
}

function stopLeftPointerDownPropagation(e: React.PointerEvent<HTMLElement>) {
  if (e.button === 0) e.stopPropagation()
}

function BlockDragHandleMenu({
  anchor,
  menuRef,
}: {
  anchor: MenuAnchor
  menuRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div
      ref={menuRef}
      role="menu"
      data-testid="block-drag-handle-menu"
      className="fixed z-[9999] w-48 -translate-y-1/2 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{
        left: anchor.left - MENU_WIDTH - MENU_GUTTER,
        top: anchor.top + anchor.height / 2,
      }}
    >
      <SubmenuItem icon={<Type className="size-4" />} label="Turn into" />
      <SubmenuItem icon={<Palette className="size-4" />} label="Color" />
      <hr className="-mx-1 my-1 h-px border-0 bg-border" />
      <MenuItem icon={<Copy className="size-4" />} label="Copy link to block" />
      <MenuItem icon={<Files className="size-4" />} label="Duplicate" />
      <MenuItem icon={<Trash2 className="size-4" />} label="Delete" destructive />
      <MenuItem icon={<MessageSquare className="size-4" />} label="Comment" />
    </div>
  )
}

function SubmenuItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false)
  const focusFirstItemOnOpenRef = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!isSubmenuOpen || !focusFirstItemOnOpenRef.current) return
    focusFirstItemOnOpenRef.current = false
    submenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [isSubmenuOpen])

  function openSubmenu({ focusFirstItem = false }: { focusFirstItem?: boolean } = {}) {
    focusFirstItemOnOpenRef.current = focusFirstItem
    setIsSubmenuOpen(true)
  }

  function closeSubmenu({ returnFocus = false }: { returnFocus?: boolean } = {}) {
    focusFirstItemOnOpenRef.current = false
    setIsSubmenuOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowRight') {
      event.preventDefault()
      openSubmenu({ focusFirstItem: true })
      return
    }
    if (event.key === 'Escape' || event.key === 'ArrowLeft') {
      event.preventDefault()
      closeSubmenu()
    }
  }

  function handleSubmenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    closeSubmenu({ returnFocus: true })
  }

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    const nextFocusedElement = event.relatedTarget
    if (nextFocusedElement instanceof Node && event.currentTarget.contains(nextFocusedElement)) {
      return
    }
    closeSubmenu()
  }

  return (
    <div
      className="relative"
      onBlur={handleBlur}
      onMouseEnter={() => openSubmenu()}
      onMouseLeave={() => closeSubmenu()}
    >
      <button
        ref={triggerRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={isSubmenuOpen}
        className={menuItemClassName()}
        onClick={showComingSoon}
        onKeyDown={handleTriggerKeyDown}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <ChevronRight className="ml-auto size-4" />
      </button>
      {isSubmenuOpen && (
        <div
          ref={submenuRef}
          role="menu"
          tabIndex={-1}
          className="absolute top-0 left-full z-[10000] ml-1 w-40 rounded-md bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
          onKeyDown={handleSubmenuKeyDown}
        >
          <MenuItem label="Coming soon" />
        </div>
      )}
    </div>
  )
}

function MenuItem({
  destructive = false,
  icon,
  label,
}: {
  destructive?: boolean
  icon?: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={menuItemClassName(destructive)}
      onClick={showComingSoon}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
    </button>
  )
}

function menuItemClassName(destructive = false) {
  return cn(
    'flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground',
    destructive
      ? 'text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive'
      : 'text-popover-foreground',
  )
}

function showComingSoon() {
  toast.info('Coming soon')
}
