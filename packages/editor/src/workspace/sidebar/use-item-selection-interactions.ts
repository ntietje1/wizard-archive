import type { MouseEvent } from 'react'
import type { AnyItem } from '../items'
import { getItemSelectionIntent } from './selection-intent'
import type { ItemSelectionModifierState } from './selection-intent'
import { useSidebarWorkspaceState } from './workspace-state'
import type { SidebarWorkspaceItemSurface } from './workspace-state'

export function useItemSelectionInteractions(
  item: AnyItem,
  activeSurface?: SidebarWorkspaceItemSurface,
) {
  const {
    selection,
    selectionCommands: {
      normalizeContextSelection,
      selectItemRange,
      selectSingleItem,
      setActiveItemSurface,
      toggleItemSelection,
    },
  } = useSidebarWorkspaceState()
  const isItemSelected = selection.selectedItemIds.includes(item.id)
  const selectedItemCount = selection.selectedItemIds.length
  const visibleItemIds = activeSurface?.visibleItemIds ?? [item.id]
  const surface =
    activeSurface && (activeSurface.surface === 'sidebar' || activeSurface.surface === 'bookmarks')
      ? { ...activeSurface, parentId: null }
      : activeSurface

  const activateSurface = () => {
    if (surface) {
      setActiveItemSurface(surface)
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
      selectItemRange(item.id, visibleItemIds)
      return
    }

    if (intent === 'toggle') {
      event.preventDefault()
      focusSelectionTarget()
      toggleItemSelection(item.id)
      return
    }

    selectSingleItem(item.id)
    onOpen?.()
  }

  const handleItemContextMenu = (_event: MouseEvent) => {
    activateSurface()
    normalizeContextSelection(item.id, visibleItemIds)
  }

  return {
    isItemSelected,
    selectedItemCount,
    handleItemClick,
    handleItemContextMenu,
  }
}
