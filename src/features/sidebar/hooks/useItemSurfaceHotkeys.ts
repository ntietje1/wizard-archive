import { useEffect, useRef } from 'react'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { normalizeSelectedRoots } from 'convex/sidebarItems/filesystem/selection'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { useOpenParentFolders } from '~/features/sidebar/hooks/useOpenParentFolders'
import {
  useActiveSidebarItems,
  useTrashSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import {
  isEditableHotkeyTarget,
  isModifierShortcut,
} from '~/features/sidebar/utils/item-surface-hotkeys'
import { getKeyboardOpenItem } from '~/features/sidebar/utils/item-surface-keyboard'
import { getKeyboardPasteParentId } from '~/features/filesystem/filesystem-targets'
import { handleError } from '~/shared/utils/logger'

type ActiveItemSurface = NonNullable<
  ReturnType<typeof useSidebarUIStore.getState>['activeItemSurface']
>

interface ResolvedHotkeySelection {
  selectedItems: Array<AnySidebarItem>
  selectedIds: Array<AnySidebarItem['_id']>
}

interface HotkeyFileSystemActions {
  cancelClipboard: () => boolean
  cut: (itemIds: Array<AnySidebarItem['_id']>) => void
  copy: (itemIds: Array<AnySidebarItem['_id']>) => void
  canPaste: boolean
  paste: (targetParentId?: AnySidebarItem['_id'] | null) => Promise<void>
  confirmDeleteForever: (itemIds: Array<AnySidebarItem['_id']>) => boolean
  trashItems: (itemIds: Array<AnySidebarItem['_id']>) => Promise<void>
}

interface HotkeyHandlerContext {
  campaignId: ReturnType<typeof useCampaign>['campaignId']
  activeItemSurface: ActiveItemSurface
  selectedItems: Array<AnySidebarItem>
  selectedIds: Array<AnySidebarItem['_id']>
  focusedItemId: AnySidebarItem['_id'] | null
  filesystem: HotkeyFileSystemActions
  setSelectedItemIds: (ids: Array<AnySidebarItem['_id']>) => void
  clearItemSelection: () => void
  setRenamingId: ReturnType<typeof useSidebarUIStore.getState>['setRenamingId']
  moveFocus: ReturnType<typeof useSidebarUIStore.getState>['moveFocus']
  navigateToItem: ReturnType<typeof useEditorNavigation>['navigateToItem']
  setLastSelectedItem: ReturnType<typeof useLastEditorItem>['setLastSelectedItem']
  openParentFolders: ReturnType<typeof useOpenParentFolders>['openParentFolders']
}

function resolveItems(
  ids: Array<AnySidebarItem['_id']>,
  allItemsMap: Map<AnySidebarItem['_id'], AnySidebarItem>,
): Array<AnySidebarItem> {
  return ids.map((id) => {
    const item = allItemsMap.get(id)
    if (!item) {
      throw new Error(`Hotkey selection references missing sidebar item ${id}`)
    }
    return item
  })
}

function resolveSelection(
  ids: Array<AnySidebarItem['_id']>,
  activeItemsMap: Map<AnySidebarItem['_id'], AnySidebarItem>,
  trashedItemsMap: Map<AnySidebarItem['_id'], AnySidebarItem>,
): ResolvedHotkeySelection {
  const allItemsMap = new Map<AnySidebarItem['_id'], AnySidebarItem>([
    ...activeItemsMap,
    ...trashedItemsMap,
  ])
  const selectedItems = normalizeSelectedRoots(resolveItems(ids, allItemsMap), allItemsMap)

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
  if (context.filesystem.cancelClipboard()) {
    return true
  }

  context.clearItemSelection()
  return true
}

function handleCopyCut(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  const isCut = isModifierShortcut(event, 'x')
  const isCopy = isModifierShortcut(event, 'c')
  if (!isCopy && !isCut) return false
  if (!context.campaignId || context.selectedIds.length === 0) return false

  event.preventDefault()
  if (isCut) {
    context.filesystem.cut(context.selectedIds)
  } else {
    context.filesystem.copy(context.selectedIds)
  }
  return true
}

function handlePaste(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  if (!isModifierShortcut(event, 'v')) return false
  if (!context.campaignId || !context.filesystem.canPaste) {
    return false
  }

  event.preventDefault()
  const pasteParentId = getKeyboardPasteParentId({
    selectedItems: context.selectedItems,
    surface: context.activeItemSurface.surface,
    surfaceParentId: context.activeItemSurface.parentId,
  })

  void context.filesystem
    .paste(pasteParentId)
    .catch((error) => handleError(error, 'Failed to paste items'))
  return true
}

function handleDelete(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return false
  if (context.selectedItems.length === 0) {
    event.preventDefault()
    return true
  }

  event.preventDefault()
  if (context.activeItemSurface.surface === 'trash') {
    context.filesystem.confirmDeleteForever(context.selectedIds)
    return true
  }

  void context.filesystem
    .trashItems(context.selectedIds)
    .catch((error) => handleError(error, 'Failed to move items to trash'))
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
  void context
    .navigateToItem(itemToOpen.slug)
    .catch((error) => handleError(error, 'Failed to open item'))
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

export function useItemSurfaceHotkeys(filesystem: HotkeyFileSystemActions) {
  const filesystemRef = useRef(filesystem)
  filesystemRef.current = filesystem
  const { campaignId } = useCampaign()
  const { itemsMap: activeItemsMap } = useActiveSidebarItems()
  const { itemsMap: trashedItemsMap } = useTrashSidebarItems()
  const { navigateToItem } = useEditorNavigation()
  const { setLastSelectedItem } = useLastEditorItem()
  const { openParentFolders } = useOpenParentFolders()

  const activeItemSurface = useSidebarUIStore((s) => s.activeItemSurface)
  const selectedItemIds = useSidebarUIStore((s) => s.selectedItemIds)
  const focusedItemId = useSidebarUIStore((s) => s.focusedItemId)
  const setSelectedItemIds = useSidebarUIStore((s) => s.setSelectedItemIds)
  const clearItemSelection = useSidebarUIStore((s) => s.clearItemSelection)
  const setRenamingId = useSidebarUIStore((s) => s.setRenamingId)
  const moveFocus = useSidebarUIStore((s) => s.moveFocus)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!activeItemSurface || isEditableHotkeyTarget(event.target)) return

      const selection = resolveSelection(selectedItemIds, activeItemsMap, trashedItemsMap)

      handleItemSurfaceHotkey(event, {
        campaignId,
        activeItemSurface,
        focusedItemId,
        filesystem: filesystemRef.current,
        setSelectedItemIds,
        clearItemSelection,
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
    moveFocus,
    navigateToItem,
    openParentFolders,
    setSelectedItemIds,
    selectedItemIds,
    setLastSelectedItem,
    setRenamingId,
    trashedItemsMap,
  ])
}
