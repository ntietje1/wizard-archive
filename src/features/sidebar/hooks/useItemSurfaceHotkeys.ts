import { useEffect, useRef } from 'react'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useSidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'
import type { SidebarWorkspaceSelection } from '~/features/sidebar/workspace/sidebar-workspace-source'
import {
  isEditableHotkeyTarget,
  isItemSurfaceHotkeyTarget,
  isModifierShortcut,
} from '~/features/sidebar/utils/item-surface-hotkeys'
import { getKeyboardOpenItem } from '~/features/sidebar/utils/item-surface-keyboard'
import { getKeyboardPasteParentId } from '~/features/filesystem/filesystem-targets'
import { resolveSidebarOperationItems } from '~/features/filesystem/filesystem-operation-selection'
import { selectionBelongsToSurface } from 'shared/sidebar-items/filesystem/selection'
import { handleError } from '~/shared/utils/logger'

type ActiveItemSurface = NonNullable<SidebarWorkspaceSelection['activeItemSurface']>

interface ResolvedHotkeySelection {
  selectedItems: Array<AnySidebarItem>
}

interface HotkeyFileSystemActions {
  cancelClipboard: () => boolean
  cut: (itemIds: Array<AnySidebarItem['_id']>) => void
  copy: (itemIds: Array<AnySidebarItem['_id']>) => void
  canPaste: boolean
  paste: (targetParentId?: AnySidebarItem['_id'] | null) => Promise<void>
  confirmDeleteForever: (itemIds: Array<AnySidebarItem['_id']>) => void
  requestTrashItems: (itemIds: Array<AnySidebarItem['_id']>) => Promise<void>
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
  setRenamingItemId: (itemId: AnySidebarItem['_id'] | null) => void
  moveFocus: (
    direction: 'up' | 'down',
    visibleItemIds: Array<AnySidebarItem['_id']>,
    extendSelection: boolean,
  ) => void
  openItem: ReturnType<typeof useSidebarWorkspaceSource>['commands']['openItem']
  openParentFolders: ReturnType<typeof useSidebarWorkspaceSource>['commands']['openParentFolders']
}

function resolveSelection(
  ids: Array<AnySidebarItem['_id']>,
  activeItemsMap: Map<AnySidebarItem['_id'], AnySidebarItem>,
  trashedItemsMap: Map<AnySidebarItem['_id'], AnySidebarItem>,
): ResolvedHotkeySelection {
  return {
    selectedItems: resolveSidebarOperationItems({
      itemIds: ids,
      activeItemsMap,
      trashedItemsMap,
    }),
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
  clearSelectionOrClipboard(context.filesystem, context.clearItemSelection)
  return true
}

function clearSelectionOrClipboard(
  filesystem: Pick<HotkeyFileSystemActions, 'cancelClipboard'>,
  clearItemSelection: () => void,
) {
  if (!filesystem.cancelClipboard()) clearItemSelection()
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
    .requestTrashItems(context.selectedIds)
    .catch((error) => handleError(error, 'Failed to move items to trash'))
  return true
}

function handleRename(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  if (event.key !== 'F2' || context.selectedItems.length !== 1) return false

  event.preventDefault()
  context.openParentFolders(context.selectedItems[0]._id)
  context.setRenamingItemId(context.selectedItems[0]._id)
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

  void context.openItem(itemToOpen.slug).catch((error) => handleError(error, 'Failed to open item'))
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
  const {
    commands: { openItem, openParentFolders, setRenamingItemId },
    items,
    selectionCommands: { clearItemSelection, getSelectionSnapshot, moveFocus, setSelectedItemIds },
  } = useSidebarWorkspaceSource()
  const contextRef = useRef({
    activeItemsMap: items.active.itemsMap,
    campaignId,
    clearItemSelection,
    getSelectionSnapshot,
    moveFocus,
    openItem,
    openParentFolders,
    setSelectedItemIds,
    setRenamingItemId,
    trashedItemsMap: items.trash.itemsMap,
  })
  contextRef.current = {
    activeItemsMap: items.active.itemsMap,
    campaignId,
    clearItemSelection,
    getSelectionSnapshot,
    moveFocus,
    openItem,
    openParentFolders,
    setSelectedItemIds,
    setRenamingItemId,
    trashedItemsMap: items.trash.itemsMap,
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const currentContext = contextRef.current
      const { activeItemSurface, focusedItemId, selectedItemIds } =
        currentContext.getSelectionSnapshot()
      if (isEditableHotkeyTarget(event.target)) return
      const isTargetingItemSurface = isItemSurfaceHotkeyTarget(event.target)

      if (event.key === 'Escape' && !activeItemSurface) {
        event.preventDefault()
        clearSelectionOrClipboard(filesystemRef.current, currentContext.clearItemSelection)
        return
      }

      if (!activeItemSurface) return
      if (!isTargetingItemSurface) return

      const surfaceSelectedItemIds = selectionBelongsToSurface(
        selectedItemIds,
        activeItemSurface.visibleItemIds,
      )
        ? selectedItemIds
        : []
      const selection = resolveSelection(
        surfaceSelectedItemIds,
        currentContext.activeItemsMap,
        currentContext.trashedItemsMap,
      )

      handleItemSurfaceHotkey(event, {
        campaignId: currentContext.campaignId,
        activeItemSurface,
        focusedItemId,
        selectedIds: surfaceSelectedItemIds,
        filesystem: filesystemRef.current,
        setSelectedItemIds: currentContext.setSelectedItemIds,
        clearItemSelection: currentContext.clearItemSelection,
        setRenamingItemId: currentContext.setRenamingItemId,
        moveFocus: currentContext.moveFocus,
        openItem: currentContext.openItem,
        openParentFolders: currentContext.openParentFolders,
        ...selection,
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
