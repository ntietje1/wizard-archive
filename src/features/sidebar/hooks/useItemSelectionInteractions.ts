import { useShallow } from 'zustand/shallow'
import type { MouseEvent } from 'react'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { getItemSelectionIntent } from '~/features/sidebar/utils/item-selection-intent'
import type { ItemSelectionModifierState } from '~/features/sidebar/utils/item-selection-intent'
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
    setSelected,
    normalizeContextSelection,
    setActiveItemSurface,
  } = useSidebarUIStore(
    useShallow((s) => ({
      isItemSelected: s.selectedItemIds.includes(item._id),
      selectedItemCount: s.selectedItemIds.length,
      selectSingleItem: s.selectSingleItem,
      toggleItemSelection: s.toggleItemSelection,
      selectItemRange: s.selectItemRange,
      setSelected: s.setSelected,
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

  const handleItemClick = (
    event: ItemSelectionModifierState & {
      preventDefault: () => void
      currentTarget: EventTarget | null
    },
    onOpen?: () => void,
  ) => {
    activateSurface()
    const intent = getItemSelectionIntent(event)
    const focusSelectionTarget = () => {
      if (event.currentTarget instanceof HTMLElement) {
        event.currentTarget.focus()
      }
    }

    if (intent === 'range') {
      event.preventDefault()
      focusSelectionTarget()
      selectItemRange(item._id, visibleItemIds)
      return
    }

    if (intent === 'toggle') {
      event.preventDefault()
      focusSelectionTarget()
      toggleItemSelection(item._id)
      return
    }

    setSelected(item.slug)
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
