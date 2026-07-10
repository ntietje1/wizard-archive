import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingMenuDismiss } from '@wizard-archive/ui/hooks/use-floating-menu-dismiss'
import { BlockSharePermissionMenu } from './permission-menu'
import { BlockShareMenuContext } from './menu-state'
import { useBlocksShare } from './use-share'
import type { BlockShareMenuState, MenuPosition } from './menu-state'
import type { BlocksShareSource } from '../contracts'
import { SHARE_MENU_WIDTH_CLASS, SHARE_MENU_WIDTH_PX } from '../menu/layout'

const MENU_GUTTER = 8

interface MenuLayoutMetrics {
  height: number
  viewportHeight: number
  viewportWidth: number
  width: number
}

export function BlockShareMenuProvider({
  blockSharing,
  children,
}: {
  blockSharing: BlocksShareSource
  children: ReactNode
}) {
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
          <BlockShareFloatingMenu
            blockSharing={blockSharing}
            menuRef={menuRef}
            menuState={menuState}
          />,
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
  blockSharing,
  menuRef,
  menuState,
}: {
  blockSharing: BlocksShareSource
  menuRef: RefObject<HTMLDivElement | null>
  menuState: BlockShareMenuState
}) {
  const [menuMetrics, setMenuMetrics] = useState<MenuLayoutMetrics | null>(null)
  const blockShare = useBlocksShare(blockSharing, menuState.blocks, menuState.note)
  const blockShareState = blockShare.status === 'available' ? blockShare.state : null

  useLayoutEffect(() => {
    if (!menuRef.current) return
    if (typeof window === 'undefined') return
    const updateMenuMetrics = () => {
      const rect = menuRef.current?.getBoundingClientRect()
      const nextMetrics = {
        height: rect?.height ?? 0,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        width: rect?.width ?? SHARE_MENU_WIDTH_PX,
      }
      setMenuMetrics((current) =>
        current &&
        current.height === nextMetrics.height &&
        current.viewportHeight === nextMetrics.viewportHeight &&
        current.viewportWidth === nextMetrics.viewportWidth &&
        current.width === nextMetrics.width
          ? current
          : nextMetrics,
      )
    }
    updateMenuMetrics()
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateMenuMetrics)
    resizeObserver?.observe(menuRef.current)
    window.addEventListener('resize', updateMenuMetrics)
    window.addEventListener('orientationchange', updateMenuMetrics)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateMenuMetrics)
      window.removeEventListener('orientationchange', updateMenuMetrics)
    }
  }, [blockShareState?.status, menuRef])

  const position = getMenuPosition(menuState.position, menuMetrics)

  if (!blockShareState || blockShareState.status !== 'ready') return null

  const {
    isMutating,
    defaultPermissionLevel,
    shareItems,
    setDefaultPermission,
    setParticipantPermission,
  } = blockShareState

  return (
    <div
      ref={menuRef}
      className={`fixed z-[9999] max-h-[calc(100vh-16px)] overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 ${SHARE_MENU_WIDTH_CLASS}`}
      style={{
        left: position.x,
        maxWidth: `calc(100vw - ${MENU_GUTTER * 2}px)`,
        top: position.y,
      }}
    >
      <BlockSharePermissionMenu
        title={menuState.title}
        isMutating={isMutating}
        shareItems={shareItems}
        defaultPermissionLevel={defaultPermissionLevel}
        onSetAllPlayersPermission={setDefaultPermission}
        onSetMemberPermission={setParticipantPermission}
      />
    </div>
  )
}

function getMenuPosition(
  position: MenuPosition,
  menuMetrics: MenuLayoutMetrics | null,
): MenuPosition {
  if (typeof window === 'undefined') return position
  const viewportHeight = menuMetrics?.viewportHeight ?? window.innerHeight
  const viewportWidth = menuMetrics?.viewportWidth ?? window.innerWidth
  const menuHeight = menuMetrics?.height ?? 0
  const menuWidth = menuMetrics?.width ?? SHARE_MENU_WIDTH_PX

  const maxY =
    menuHeight > 0
      ? Math.max(MENU_GUTTER, viewportHeight - menuHeight - MENU_GUTTER)
      : viewportHeight - MENU_GUTTER

  return {
    x: Math.max(
      MENU_GUTTER,
      Math.min(
        position.x + MENU_GUTTER,
        Math.max(MENU_GUTTER, viewportWidth - menuWidth - MENU_GUTTER),
      ),
    ),
    y: Math.max(MENU_GUTTER, Math.min(position.y, maxY)),
  }
}
