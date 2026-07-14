import type { ResourceId } from '../../resources/domain-id'
import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'

import { useSidebarWorkspaceState } from './workspace-state'
import type {
  SidebarWorkspaceItemSurface,
  SidebarWorkspaceItemSurfaceName,
} from './workspace-state'
import {
  ITEM_SURFACE_HOTKEY_TARGET_ATTRIBUTE,
  isItemSurfaceInteractionTarget,
} from './item-surface-hotkeys'
import { sameItemSurfaceIdentity, sameItemSurfaceWithVisibleIds } from './item-surface-comparison'

export function useItemSurfaceRegistration({
  surface,
  parentId,
  visibleItemIds,
}: {
  surface: SidebarWorkspaceItemSurfaceName
  parentId: ResourceId | null
  visibleItemIds: ReadonlyArray<ResourceId>
}) {
  const {
    selection: { activeItemSurface },
    selectionCommands: { clearItemSelection, setActiveItemSurface },
  } = useSidebarWorkspaceState()
  const activeSurface: SidebarWorkspaceItemSurface = { surface, parentId, visibleItemIds }
  const visibleItemIdsKey = visibleItemIds.join('\u001f')
  const latestSurfaceRef = useRef(activeSurface)
  const activeItemSurfaceRef = useRef(activeItemSurface)
  const setActiveItemSurfaceRef = useRef(setActiveItemSurface)
  latestSurfaceRef.current = activeSurface
  activeItemSurfaceRef.current = activeItemSurface
  setActiveItemSurfaceRef.current = setActiveItemSurface

  // Keep the active owner in sync with item list changes without letting an inactive surface steal focus.
  useEffect(() => {
    const currentSurface = activeItemSurfaceRef.current
    if (sameItemSurfaceIdentity(currentSurface, latestSurfaceRef.current)) {
      activeItemSurfaceRef.current = latestSurfaceRef.current
      setActiveItemSurfaceRef.current(latestSurfaceRef.current)
    }
  }, [surface, parentId, visibleItemIdsKey])

  useEffect(() => {
    return () => {
      const registeredSurface = latestSurfaceRef.current
      const currentSurface = activeItemSurfaceRef.current
      if (sameItemSurfaceWithVisibleIds(currentSurface, registeredSurface)) {
        setActiveItemSurfaceRef.current(null)
      }
    }
  }, [])

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
