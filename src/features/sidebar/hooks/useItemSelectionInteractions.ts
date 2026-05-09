import type { MouseEvent } from 'react'
import { useShallow } from 'zustand/shallow'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
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
  const visibleItemIds = activeSurface?.visibleItemIds ?? [item._id]

  const activateSurface = () => {
    if (activeSurface) {
      setActiveItemSurface(activeSurface)
    }
  }

  const handleItemClick = (event: MouseEvent, onOpen?: () => void) => {
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
  }

  const handleItemContextMenu = (_event: MouseEvent) => {
    activateSurface()
    normalizeContextSelection(item._id, visibleItemIds)
  }

  return {
    isItemSelected,
    selectedItemCount,
    handleItemClick,
    handleItemContextMenu,
  }
}
