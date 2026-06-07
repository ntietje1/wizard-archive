import type { MouseEvent } from 'react'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { getItemSelectionIntent } from '~/features/sidebar/utils/item-selection-intent'
import type { ItemSelectionModifierState } from '~/features/sidebar/utils/item-selection-intent'
import { useSidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'
import type { SidebarWorkspaceItemSurface } from '~/features/sidebar/workspace/sidebar-workspace-source'

export function useItemSelectionInteractions(
  item: AnySidebarItem,
  activeSurface?: SidebarWorkspaceItemSurface,
) {
  const {
    selection,
    selectionCommands: {
      normalizeContextSelection,
      selectItemRange,
      selectSingleItem,
      setActiveItemSurface,
      setSelected,
      toggleItemSelection,
    },
  } = useSidebarWorkspaceSource()
  const isItemSelected = selection.selectedItemIds.includes(item._id)
  const selectedItemCount = selection.selectedItemIds.length
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
