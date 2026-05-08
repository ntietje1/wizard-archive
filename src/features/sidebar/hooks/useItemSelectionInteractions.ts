import { useCallback, useMemo } from 'react'
import type { MouseEvent } from 'react'
import { useShallow } from 'zustand/shallow'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { getItemSelectionIntent } from '~/features/sidebar/utils/item-selection-intent'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import type { ActiveItemSurface } from '~/features/sidebar/stores/sidebar-ui-store'

export function useItemSelectionInteractions(
  item: AnySidebarItem,
  activeSurface?: ActiveItemSurface,
) {
  const {
    isItemSelected,
    selectedItemCount,
    selectSingleItem,
    toggleItemSelection,
    selectItemRange,
    normalizeContextSelection,
    setActiveItemSurface,
  } = useSidebarUIStore(
    useShallow((s) => ({
      isItemSelected: s.selectedItemIds.includes(item._id),
      selectedItemCount: s.selectedItemIds.length,
      selectSingleItem: s.selectSingleItem,
      toggleItemSelection: s.toggleItemSelection,
      selectItemRange: s.selectItemRange,
      normalizeContextSelection: s.normalizeContextSelection,
      setActiveItemSurface: s.setActiveItemSurface,
    })),
  )
  const visibleItemIds = useMemo<Array<Id<'sidebarItems'>>>(
    () => activeSurface?.visibleItemIds ?? [item._id],
    [activeSurface?.visibleItemIds, item._id],
  )

  const activateSurface = useCallback(() => {
    if (activeSurface) {
      setActiveItemSurface(activeSurface)
    }
  }, [activeSurface, setActiveItemSurface])

  const handleItemClick = useCallback(
    (event: MouseEvent, onOpen?: () => void) => {
      activateSurface()
      const intent = getItemSelectionIntent(event)

      if (intent === 'range') {
        event.preventDefault()
        selectItemRange(item._id, visibleItemIds)
        return
      }

      if (intent === 'toggle') {
        event.preventDefault()
        toggleItemSelection(item._id)
        return
      }

      selectSingleItem(item._id)
      onOpen?.()
    },
    [
      activateSurface,
      item._id,
      selectItemRange,
      selectSingleItem,
      toggleItemSelection,
      visibleItemIds,
    ],
  )

  const handleItemContextMenu = useCallback(
    (_event?: MouseEvent) => {
      activateSurface()
      normalizeContextSelection(item._id, visibleItemIds)
    },
    [activateSurface, item._id, normalizeContextSelection, visibleItemIds],
  )

  return {
    isItemSelected,
    selectedItemCount,
    handleItemClick,
    handleItemContextMenu,
  }
}
