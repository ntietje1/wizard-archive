import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { MaybePromise } from '../../../../../shared/common/async'
import type { AnyItem } from '../items'
import { getClientErrorMessage } from '../../../../../shared/errors/client'
import { selectionBelongsToSurface } from '../../filesystem/selection'
import { toast } from 'sonner'
import { useSidebarWorkspaceState } from './workspace-state'
import type { SidebarWorkspaceSelection } from './workspace-state'
import {
  eventBelongsToHotkeyScope,
  isEditableHotkeyTarget,
  isItemSurfaceHotkeyTarget,
  isModifierShortcut,
  isNestedInteractiveHotkeyTarget,
} from './item-surface-hotkeys'
import { getKeyboardOpenItem, getKeyboardPasteParentId } from './item-surface-keyboard'
import { useRevealSidebarItemParents } from './use-reveal-item-parents'
import type { ResourceCommandResult } from '../../filesystem/transaction-contract'
import type { ResourceTrashRequestResult } from '../../filesystem/operation-runtime-contract'
import { reportResourceCommandFailure } from '../../filesystem/report-command-result'

type ActiveItemSurface = NonNullable<SidebarWorkspaceSelection['activeItemSurface']>

interface ResolvedHotkeySelection {
  selectedItems: Array<AnyItem>
}

export interface HotkeyFileSystemActions {
  cancelClipboard: () => boolean
  cut: (itemIds: Array<AnyItem['id']>) => void
  copy: (itemIds: Array<AnyItem['id']>) => void
  canUseClipboardOperations: boolean
  canPaste: boolean
  canDeleteItemsForever: (items: Array<AnyItem>) => boolean
  canRenameItem: (item: AnyItem) => boolean
  canTrashItems: (items: Array<AnyItem>) => boolean
  paste: (targetParentId?: AnyItem['id'] | null) => MaybePromise<ResourceCommandResult>
  confirmDeleteForever: (itemIds: Array<AnyItem['id']>) => void
  requestTrashItems: (itemIds: Array<AnyItem['id']>) => MaybePromise<ResourceTrashRequestResult>
  getVisibleAncestors: (itemId: AnyItem['id']) => ReadonlyArray<{
    id: AnyItem['id']
  }>
  resolveOperationItems: (input: { itemIds: ReadonlyArray<AnyItem['id']> }) => Array<AnyItem>
  openItem: (itemId: AnyItem['id']) => unknown
}

interface HotkeyHandlerContext {
  activeItemSurface: ActiveItemSurface
  selectedItems: Array<AnyItem>
  selectedIds: ReadonlyArray<AnyItem['id']>
  focusedItemId: AnyItem['id'] | null
  filesystem: HotkeyFileSystemActions
  setSelectedItemIds: (ids: ReadonlyArray<AnyItem['id']>) => void
  clearItemSelection: () => void
  setRenamingItemId: (itemId: AnyItem['id'] | null) => void
  moveFocus: (
    direction: 'up' | 'down',
    visibleItemIds: ReadonlyArray<AnyItem['id']>,
    extendSelection: boolean,
  ) => void
  openItem: HotkeyFileSystemActions['openItem']
  revealSidebarItemParents: (itemId: AnyItem['id']) => void
}

function resolveSelection(
  ids: ReadonlyArray<AnyItem['id']>,
  filesystem: Pick<HotkeyFileSystemActions, 'resolveOperationItems'>,
): ResolvedHotkeySelection {
  return {
    selectedItems: filesystem.resolveOperationItems({ itemIds: ids }),
  }
}

function handleArrowNavigation(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false
  if (event.altKey || event.ctrlKey || event.metaKey) return false

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

function reportItemSurfaceHotkeyError(error: unknown, fallbackMessage: string) {
  toast.error(getClientErrorMessage(error) ?? fallbackMessage)
  console.error(error)
}

function handleCopyCut(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  const isCut = isModifierShortcut(event, 'x')
  const isCopy = isModifierShortcut(event, 'c')
  if (!isCopy && !isCut) return false
  if (!context.filesystem.canUseClipboardOperations || context.selectedIds.length === 0) {
    return false
  }

  event.preventDefault()
  if (isCut) {
    context.filesystem.cut([...context.selectedIds])
  } else {
    context.filesystem.copy([...context.selectedIds])
  }
  return true
}

function handlePaste(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  if (!isModifierShortcut(event, 'v')) return false
  if (!context.filesystem.canUseClipboardOperations) return false
  if (!context.filesystem.canPaste) return false

  event.preventDefault()
  const pasteParentId = getKeyboardPasteParentId({
    selectedItems: context.selectedItems,
    surface: context.activeItemSurface.surface,
    surfaceParentId: context.activeItemSurface.parentId,
  })

  void Promise.resolve(context.filesystem.paste(pasteParentId))
    .then((result) => reportResourceCommandFailure(result, 'Failed to paste items'))
    .catch((error) => reportItemSurfaceHotkeyError(error, 'Failed to paste items'))
  return true
}

function handleDelete(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  if (event.key !== 'Delete' && event.key !== 'Backspace') return false
  if (context.selectedItems.length === 0) {
    event.preventDefault()
    return true
  }

  if (context.activeItemSurface.surface === 'trash') {
    if (!context.filesystem.canDeleteItemsForever(context.selectedItems)) return false
    event.preventDefault()
    context.filesystem.confirmDeleteForever([...context.selectedIds])
    return true
  }

  if (!context.filesystem.canTrashItems(context.selectedItems)) return false
  event.preventDefault()
  void Promise.resolve(context.filesystem.requestTrashItems([...context.selectedIds]))
    .then((result) => reportResourceCommandFailure(result, 'Failed to move items to trash'))
    .catch((error) => reportItemSurfaceHotkeyError(error, 'Failed to move items to trash'))
  return true
}

function handleRename(event: KeyboardEvent, context: HotkeyHandlerContext): boolean {
  if (event.key !== 'F2' || context.selectedItems.length !== 1) return false
  if (context.activeItemSurface.surface !== 'sidebar') return false
  if (!context.filesystem.canRenameItem(context.selectedItems[0])) return false

  event.preventDefault()
  context.revealSidebarItemParents(context.selectedItems[0].id)
  context.setRenamingItemId(context.selectedItems[0].id)
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

  void Promise.resolve(context.openItem(itemToOpen.id)).catch((error: unknown) =>
    reportItemSurfaceHotkeyError(error, 'Failed to open item'),
  )
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

function isNonRepeatableItemSurfaceHotkey(event: KeyboardEvent) {
  return (
    event.key === 'Backspace' ||
    event.key === 'Delete' ||
    event.key === 'Enter' ||
    event.key === 'Escape' ||
    event.key === 'F2' ||
    isModifierShortcut(event, 'a') ||
    isModifierShortcut(event, 'c') ||
    isModifierShortcut(event, 'v') ||
    isModifierShortcut(event, 'x')
  )
}

export function useItemSurfaceHotkeys(
  filesystem: HotkeyFileSystemActions,
  options: { scopeRef?: RefObject<HTMLElement | null> } = {},
) {
  const filesystemRef = useRef(filesystem)
  filesystemRef.current = filesystem
  const scopeRef = options.scopeRef
  const {
    editing: { setRenamingItemId },
    selectionCommands: { clearItemSelection, getSelectionSnapshot, moveFocus, setSelectedItemIds },
  } = useSidebarWorkspaceState()
  const revealSidebarItemParents = useRevealSidebarItemParents(filesystem)
  const contextRef = useRef({
    clearItemSelection,
    getSelectionSnapshot,
    moveFocus,
    revealSidebarItemParents,
    setSelectedItemIds,
    setRenamingItemId,
  })
  contextRef.current = {
    clearItemSelection,
    getSelectionSnapshot,
    moveFocus,
    revealSidebarItemParents,
    setSelectedItemIds,
    setRenamingItemId,
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!eventBelongsToHotkeyScope(event, scopeRef?.current ?? null)) return
      const currentContext = contextRef.current
      const { activeItemSurface, focusedItemId, selectedItemIds } =
        currentContext.getSelectionSnapshot()
      if (isEditableHotkeyTarget(event.target)) return
      const isTargetingItemSurface = isItemSurfaceHotkeyTarget(event.target)
      const isNestedInteractiveTarget = isNestedInteractiveHotkeyTarget(event.target)
      if (event.key !== 'Escape' && (event.defaultPrevented || isNestedInteractiveTarget)) {
        return
      }

      if (event.key === 'Escape' && !activeItemSurface) {
        if (!isTargetingItemSurface) return
        event.preventDefault()
        clearSelectionOrClipboard(filesystemRef.current, currentContext.clearItemSelection)
        return
      }

      if (!activeItemSurface) return
      if (!isTargetingItemSurface) return
      if (event.repeat && isNonRepeatableItemSurfaceHotkey(event)) {
        event.preventDefault()
        return
      }

      const surfaceSelectedItemIds = selectionBelongsToSurface(
        selectedItemIds,
        activeItemSurface.visibleItemIds,
      )
        ? selectedItemIds
        : []
      const selection = resolveSelection(surfaceSelectedItemIds, filesystemRef.current)

      handleItemSurfaceHotkey(event, {
        activeItemSurface,
        focusedItemId,
        selectedIds: surfaceSelectedItemIds,
        filesystem: filesystemRef.current,
        setSelectedItemIds: currentContext.setSelectedItemIds,
        clearItemSelection: currentContext.clearItemSelection,
        setRenamingItemId: currentContext.setRenamingItemId,
        moveFocus: currentContext.moveFocus,
        openItem: filesystemRef.current.openItem,
        revealSidebarItemParents: currentContext.revealSidebarItemParents,
        ...selection,
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [scopeRef])
}
