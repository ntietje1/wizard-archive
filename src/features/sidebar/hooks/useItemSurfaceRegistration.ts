import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'
import type { SidebarItemId } from 'shared/common/ids'
import { useSidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'
import type {
  SidebarWorkspaceItemSurface,
  SidebarWorkspaceItemSurfaceName,
} from '~/features/sidebar/workspace/sidebar-workspace-source'
import {
  ITEM_SURFACE_HOTKEY_TARGET_ATTRIBUTE,
  isItemSurfaceInteractionTarget,
} from '~/features/sidebar/utils/item-surface-hotkeys'

function sameVisibleIds(a: Array<SidebarItemId>, b: Array<SidebarItemId>): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

function sameRegisteredSurface(
  a: SidebarWorkspaceItemSurface | null,
  b: SidebarWorkspaceItemSurface | null,
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.surface === b.surface &&
    a.parentId === b.parentId &&
    sameVisibleIds(a.visibleItemIds, b.visibleItemIds)
  )
}

function sameSurfaceIdentity(
  a: SidebarWorkspaceItemSurface | null,
  b: SidebarWorkspaceItemSurface | null,
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.surface === b.surface && a.parentId === b.parentId
}

export function useItemSurfaceRegistration({
  surface,
  parentId,
  visibleItemIds,
}: {
  surface: SidebarWorkspaceItemSurfaceName
  parentId: SidebarItemId | null
  visibleItemIds: Array<SidebarItemId>
}) {
  const {
    selection: { activeItemSurface },
    selectionCommands: { clearItemSelection, setActiveItemSurface },
  } = useSidebarWorkspaceSource()
  const activeSurface: SidebarWorkspaceItemSurface = { surface, parentId, visibleItemIds }
  const visibleItemIdsKey = visibleItemIds.join('\u001f')
  const latestSurfaceRef = useRef(activeSurface)
  const activeItemSurfaceRef = useRef(activeItemSurface)
  latestSurfaceRef.current = activeSurface
  activeItemSurfaceRef.current = activeItemSurface

  // Keep the active owner in sync with item list changes without letting an inactive surface steal focus.
  useEffect(() => {
    const currentSurface = activeItemSurfaceRef.current
    if (sameSurfaceIdentity(currentSurface, latestSurfaceRef.current)) {
      activeItemSurfaceRef.current = latestSurfaceRef.current
      setActiveItemSurface(latestSurfaceRef.current)
    }
  }, [surface, parentId, visibleItemIdsKey, setActiveItemSurface])

  useEffect(() => {
    return () => {
      const registeredSurface = latestSurfaceRef.current
      const currentSurface = activeItemSurfaceRef.current
      if (sameRegisteredSurface(currentSurface, registeredSurface)) {
        setActiveItemSurface(null)
      }
    }
  }, [setActiveItemSurface])

  const activateSurface = () => {
    activeItemSurfaceRef.current = latestSurfaceRef.current
    setActiveItemSurface(latestSurfaceRef.current)
  }

  const handleSurfacePointerDown = (event: PointerEvent) => {
    activateSurface()
    if (!isItemSurfaceInteractionTarget(event.target)) {
      clearItemSelection()
    }
  }

  const itemSurfaceHotkeyProps = {
    [ITEM_SURFACE_HOTKEY_TARGET_ATTRIBUTE]: 'true',
    tabIndex: -1,
  }

  return { activeSurface, activateSurface, handleSurfacePointerDown, itemSurfaceHotkeyProps }
}
