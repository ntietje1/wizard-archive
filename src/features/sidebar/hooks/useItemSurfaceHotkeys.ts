import { useEffect } from 'react'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import { useSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import {
  isEditableHotkeyTarget,
  isModifierShortcut,
} from '~/features/sidebar/utils/item-surface-hotkeys'
import {
  getKeyboardOpenItem,
  getKeyboardPasteParentId,
} from '~/features/sidebar/utils/item-surface-keyboard'

interface ItemSurfaceHotkeyOperations {
  copyItems: (items: Array<AnySidebarItem>) => void
  cutItems: (items: Array<AnySidebarItem>) => void
  pasteClipboard: (targetParentId?: AnySidebarItem['_id'] | null) => Promise<void>
  trashItems: (items: Array<AnySidebarItem>) => Promise<unknown>
  confirmPermanentDeleteItems: (items: Array<AnySidebarItem>) => void
  normalizeItems: (items: Array<AnySidebarItem>) => Array<AnySidebarItem>
}

type ActiveItemSurface = NonNullable<
  ReturnType<typeof useSidebarUIStore.getState>['activeItemSurface']
>

interface ResolvedHotkeySelection {
  selectedItems: Array<AnySidebarItem>
  selectedIds: Array<AnySidebarItem['_id']>
}

interface HotkeyHandlerContext {
  campaignId: ReturnType<typeof useCampaign>['campaignId']
  activeItemSurface: ActiveItemSurface
  activeItemsMap: Map<AnySidebarItem['_id'], AnySidebarItem>
  trashedItemsMap: Map<AnySidebarItem['_id'], AnySidebarItem>
  selectedItems: Array<AnySidebarItem>
  selectedIds: Array<AnySidebarItem['_id']>
  focusedItemId: AnySidebarItem['_id'] | null
  itemClipboard: ReturnType<typeof useSidebarUIStore.getState>['itemClipboard']
  itemOperations?: ItemSurfaceHotkeyOperations
  setSelectedItemIds: (ids: Array<AnySidebarItem['_id']>) => void
  clearItemSelection: () => void
  setItemClipboard: ReturnType<typeof useSidebarUIStore.getState>['setItemClipboard']
  setRenamingId: ReturnType<typeof useSidebarUIStore.getState>['setRenamingId']
  moveFocus: ReturnType<typeof useSidebarUIStore.getState>['moveFocus']
  navigateToItem: ReturnType<typeof useEditorNavigation>['navigateToItem']
  setLastSelectedItem: ReturnType<typeof useLastEditorItem>['setLastSelectedItem']
  openParentFolders: ReturnType<typeof useOpenParentFolders>['openParentFolders']
}

function resolveItems(
  ids: Array<AnySidebarItem['_id']>,
  activeItemsMap: Map<AnySidebarItem['_id'], AnySidebarItem>,
  trashedItemsMap: Map<AnySidebarItem['_id'], AnySidebarItem>,
): Array<AnySidebarItem> {
  return ids
    .map((id) => activeItemsMap.get(id) ?? trashedItemsMap.get(id))
    .filter((item): item is AnySidebarItem => Boolean(item))
}

function resolveSelection(
  ids: Array<AnySidebarItem['_id']>,
  activeItemsMap: Map<AnySidebarItem['_id'], AnySidebarItem>,
  trashedItemsMap: Map<AnySidebarItem['_id'], AnySidebarItem>,
  itemOperations?: ItemSurfaceHotkeyOperations,
): ResolvedHotkeySelection {
  const rawSelectedItems = resolveItems(ids, activeItemsMap, trashedItemsMap)
  const selectedItems = itemOperations
    ? itemOperations.normalizeItems(rawSelectedItems)
    : rawSelectedItems

  return {
    selectedItems,
    selectedIds: selectedItems.map((item) => item._id),
  }
}

function handleArrowNavigation(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false

  event.preventDefault()
  context.moveFocus(
    event.key === 'ArrowDown' ? 'down' : 'up',
    context.activeItemSurface.visibleItemIds,
    event.shiftKey,
  )
  return true
}

function handleSelectAll(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  if (!isModifierShortcut(event, 'a')) return false

  event.preventDefault()
  context.setSelectedItemIds(context.activeItemSurface.visibleItemIds)
  return true
}

function handleEscape(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  if (event.key !== 'Escape') return false

  event.preventDefault()
  context.clearItemSelection()
  return true
}

function handleCopyCut(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  const isCut = isModifierShortcut(event, 'x')
  const isCopy = isModifierShortcut(event, 'c')
  if (!isCopy && !isCut) return false
  if (!context.campaignId || context.selectedIds.length === 0) return true

  event.preventDefault()
  if (context.itemOperations) {
    if (isCut) {
      context.itemOperations.cutItems(context.selectedItems)
    } else {
      context.itemOperations.copyItems(context.selectedItems)
    }
    return true
  }

  context.setItemClipboard({
    mode: isCut ? 'cut' : 'copy',
    campaignId: context.campaignId,
    itemIds: context.selectedIds,
  })
  return true
}

function handlePaste(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  if (!isModifierShortcut(event, 'v')) return false
  if (
    !context.campaignId ||
    !context.itemClipboard ||
    context.itemClipboard.campaignId !== context.campaignId
  ) {
    return true
  }

  event.preventDefault()
  const pasteParentId = getKeyboardPasteParentId({
    selectedItems: context.selectedItems,
    focusedItemId: context.focusedItemId,
    surfaceParentId: context.activeItemSurface.parentId,
  })

  void context.itemOperations?.pasteClipboard(pasteParentId)
  return true
}

function handleDelete(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return false
  if (context.selectedItems.length === 0) return true

  event.preventDefault()
  if (context.activeItemSurface.surface === 'trash') {
    context.itemOperations?.confirmPermanentDeleteItems(context.selectedItems)
    return true
  }

  void context.itemOperations?.trashItems(context.selectedItems)
  return true
}

function handleRename(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  if (event.key !== 'F2' || context.selectedItems.length !== 1) return false

  event.preventDefault()
  context.openParentFolders(context.selectedItems[0]._id)
  context.setRenamingId(context.selectedItems[0]._id)
  return true
}

function handleOpen(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  if (event.key !== 'Enter' || context.selectedItems.length === 0) return false

  event.preventDefault()
  const itemToOpen = getKeyboardOpenItem({
    selectedItems: context.selectedItems,
    focusedItemId: context.focusedItemId,
  })
  if (!itemToOpen) return true

  context.setLastSelectedItem(itemToOpen.slug)
  void context.navigateToItem(itemToOpen.slug)
  return true
}

function handleItemSurfaceHotkey(event: KeyboardEvent, context: HotkeyHandlerContext) {
  return (
    handleArrowNavigation(event, context) ||
    handleSelectAll(event, context) ||
    handleEscape(event, context) ||
    handleCopyCut(event, context) ||
    handlePaste(event, context) ||
    handleDelete(event, context) ||
    handleRename(event, context) ||
    handleOpen(event, context)
  )
}

export function useItemSurfaceHotkeys(itemOperations?: ItemSurfaceHotkeyOperations) {
  const { campaignId } = useCampaign()
  const { itemsMap: activeItemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.sidebar)
  const { itemsMap: trashedItemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.trash)
  const { navigateToItem } = useEditorNavigation()
  const { setLastSelectedItem } = useLastEditorItem()
  const { openParentFolders } = useOpenParentFolders()

  const activeItemSurface = useSidebarUIStore((s) => s.activeItemSurface)
  const selectedItemIds = useSidebarUIStore((s) => s.selectedItemIds)
  const focusedItemId = useSidebarUIStore((s) => s.focusedItemId)
  const itemClipboard = useSidebarUIStore((s) => s.itemClipboard)
  const setSelectedItemIds = useSidebarUIStore((s) => s.setSelectedItemIds)
  const clearItemSelection = useSidebarUIStore((s) => s.clearItemSelection)
  const setItemClipboard = useSidebarUIStore((s) => s.setItemClipboard)
  const setRenamingId = useSidebarUIStore((s) => s.setRenamingId)
  const moveFocus = useSidebarUIStore((s) => s.moveFocus)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeItemSurface || isEditableHotkeyTarget(event.target)) return

      const selection = resolveSelection(
        selectedItemIds,
        activeItemsMap,
        trashedItemsMap,
        itemOperations,
      )

      handleItemSurfaceHotkey(event, {
        campaignId,
        activeItemSurface,
        activeItemsMap,
        trashedItemsMap,
        focusedItemId,
        itemClipboard,
        itemOperations,
        setSelectedItemIds,
        clearItemSelection,
        setItemClipboard,
        setRenamingId,
        moveFocus,
        navigateToItem,
        setLastSelectedItem,
        openParentFolders,
        ...selection,
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    activeItemSurface,
    activeItemsMap,
    campaignId,
    clearItemSelection,
    focusedItemId,
    itemClipboard,
    itemOperations,
    moveFocus,
    navigateToItem,
    openParentFolders,
    setSelectedItemIds,
    selectedItemIds,
    setItemClipboard,
    setLastSelectedItem,
    setRenamingId,
    trashedItemsMap,
  ])
}
