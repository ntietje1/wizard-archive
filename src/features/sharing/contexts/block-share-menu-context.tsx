import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { BlockSharePermissionMenu } from '~/features/sharing/components/block-share-permission-menu'
import { BlockShareMenuContext } from '~/features/sharing/contexts/block-share-menu-state'
import { useBlocksShare } from '~/features/sharing/hooks/useBlocksShare'
import { useFloatingMenuDismiss } from '~/shared/hooks/use-floating-menu-dismiss'
import type { BlockShareMenuState, MenuPosition } from './block-share-menu-state'

const MENU_WIDTH = 340
const MENU_GUTTER = 8

export function BlockShareMenuProvider({ children }: { children: ReactNode }) {
  const [menuState, setMenuState] = useState<BlockShareMenuState | null>(null)
  const [contextValue] = useState(() => ({
    open: setMenuState,
    close: () => setMenuState(null),
  }))
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuState) return
    const sideMenuController = menuState.sideMenuController
    if (!sideMenuController) return

    sideMenuController.freezeMenu()
    return () => {
      sideMenuController.unfreezeMenu()
    }
  }, [menuState])

  useFloatingMenuDismiss({
    enabled: Boolean(menuState),
    ignoreTarget: isBlockShareMenuOverlayTarget,
    menuRef,
    onDismiss: () => setMenuState(null),
  })

  return (
    <BlockShareMenuContext.Provider value={contextValue}>
      {children}
      {menuState &&
        typeof document !== 'undefined' &&
        createPortal(
          <BlockShareFloatingMenu menuRef={menuRef} menuState={menuState} />,
          document.body,
        )}
    </BlockShareMenuContext.Provider>
  )
}

function isBlockShareMenuOverlayTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('[data-block-share-menu-overlay="true"]'))
}

function BlockShareFloatingMenu({
  menuRef,
  menuState,
}: {
  menuRef: RefObject<HTMLDivElement | null>
  menuState: BlockShareMenuState
}) {
  const [menuHeight, setMenuHeight] = useState(0)
  const {
    isPending,
    isMutating,
    allPlayersPermissionLevel,
    shareItems,
    setAllPlayersPermission,
    setMemberPermission,
  } = useBlocksShare(menuState.blocks, menuState.note)

  useLayoutEffect(() => {
    if (!menuRef.current) return
    const updateMenuHeight = () => {
      setMenuHeight(menuRef.current?.getBoundingClientRect().height ?? 0)
    }
    updateMenuHeight()
    if (typeof ResizeObserver === 'undefined') return
    const resizeObserver = new ResizeObserver(updateMenuHeight)
    resizeObserver.observe(menuRef.current)
    return () => resizeObserver.disconnect()
  }, [menuRef])

  const position = getMenuPosition(menuState.position, menuHeight)

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] max-h-[calc(100vh-16px)] overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{
        left: position.x,
        top: position.y,
        width: MENU_WIDTH,
      }}
    >
      <BlockSharePermissionMenu
        title={menuState.title}
        isPending={isPending}
        isMutating={isMutating}
        shareItems={shareItems}
        allPlayersPermissionLevel={allPlayersPermissionLevel}
        onSetAllPlayersPermission={setAllPlayersPermission}
        onSetMemberPermission={setMemberPermission}
      />
    </div>
  )
}

function getMenuPosition(position: MenuPosition, menuHeight: number): MenuPosition {
  if (typeof window === 'undefined') return position

  const maxY =
    menuHeight > 0
      ? Math.max(MENU_GUTTER, window.innerHeight - menuHeight - MENU_GUTTER)
      : window.innerHeight - MENU_GUTTER

  return {
    x: Math.max(
      MENU_GUTTER,
      Math.min(position.x + MENU_GUTTER, window.innerWidth - MENU_WIDTH - MENU_GUTTER),
    ),
    y: Math.max(MENU_GUTTER, Math.min(position.y, maxY)),
  }
}
