import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import type { ActiveItemSurface, ItemSurface } from '~/features/sidebar/stores/sidebar-ui-store'
import { isItemSurfaceInteractionTarget } from '~/features/sidebar/utils/item-surface-hotkeys'

function sameVisibleIds(a: Array<Id<'sidebarItems'>>, b: Array<Id<'sidebarItems'>>): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

function sameRegisteredSurface(a: ActiveItemSurface | null, b: ActiveItemSurface | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.surface === b.surface &&
    a.parentId === b.parentId &&
    sameVisibleIds(a.visibleItemIds, b.visibleItemIds)
  )
}

export function useItemSurfaceRegistration({
  surface,
  parentId,
  visibleItemIds,
}: {
  surface: ItemSurface
  parentId: Id<'sidebarItems'> | null
  visibleItemIds: Array<Id<'sidebarItems'>>
}) {
  const setActiveItemSurface = useSidebarUIStore((s) => s.setActiveItemSurface)
  const clearItemSelection = useSidebarUIStore((s) => s.clearItemSelection)
  const activeSurface: ActiveItemSurface = { surface, parentId, visibleItemIds }
  const visibleItemIdsKey = visibleItemIds.join('\u001f')
  const latestSurfaceRef = useRef(activeSurface)
  latestSurfaceRef.current = activeSurface

  useEffect(() => {
    setActiveItemSurface(latestSurfaceRef.current)
    return () => {
      const currentSurface = useSidebarUIStore.getState().activeItemSurface
      if (sameRegisteredSurface(currentSurface, latestSurfaceRef.current)) {
        setActiveItemSurface(null)
      }
    }
  }, [surface, parentId, visibleItemIdsKey, setActiveItemSurface])

  const activateSurface = () => {
    setActiveItemSurface(activeSurface)
  }

  const handleSurfacePointerDown = (event: PointerEvent) => {
    activateSurface()
    if (!isItemSurfaceInteractionTarget(event.target)) {
      clearItemSelection()
    }
  }

  return { activeSurface, activateSurface, handleSurfacePointerDown }
}
