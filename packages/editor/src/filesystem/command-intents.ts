import type { SidebarItemId } from '../../../../shared/common/ids'
import { normalizeSelectedRoots } from './domain/selection-roots'
import type { ResourceCommand } from './transaction-contract'
import { isActiveResourceItem } from '../workspace/items'
import type { AnyItem, WorkspaceResourceReadModel } from '../workspace/items'
import type { FileSystemClipboard } from './clipboard'

function normalizeActiveItems(
  itemIds: Array<SidebarItemId>,
  readModel: WorkspaceResourceReadModel<AnyItem>,
) {
  return normalizeSelectedRoots(
    readModel.getItems(itemIds).filter(isActiveResourceItem),
    readModel.itemsById,
  )
}

function resolvePasteTargetParentId(
  activeItemSurface: { parentId: SidebarItemId | null } | null,
  targetParentId?: SidebarItemId | null,
): SidebarItemId | null {
  return targetParentId === undefined ? (activeItemSurface?.parentId ?? null) : targetParentId
}

export function resolveFileSystemClipboardCommand({
  clipboard,
  workspaceId,
  activeItemSurface,
  targetParentId,
  readModel,
}: {
  clipboard: FileSystemClipboard | null
  workspaceId: string
  activeItemSurface: { parentId: SidebarItemId | null } | null
  targetParentId?: SidebarItemId | null
  readModel: WorkspaceResourceReadModel<AnyItem>
}): { command: ResourceCommand | null; clearClipboard: boolean } {
  if (!clipboard || clipboard.workspaceId !== workspaceId) {
    return { command: null, clearClipboard: false }
  }

  const resolvedTargetParentId = resolvePasteTargetParentId(activeItemSurface, targetParentId)
  const items = normalizeActiveItems(Array.from(clipboard.itemIds), readModel)
  if (items.length === 0) return { command: null, clearClipboard: true }

  const itemIds = items.map((item) => item.id)
  if (clipboard.mode === 'copy') {
    return {
      command: { type: 'copy', itemIds, targetParentId: resolvedTargetParentId },
      clearClipboard: false,
    }
  }

  if (items.every((item) => item.parentId === resolvedTargetParentId)) {
    return { command: null, clearClipboard: true }
  }

  return {
    command: { type: 'move', itemIds, targetParentId: resolvedTargetParentId },
    clearClipboard: true,
  }
}

export function createFileSystemClipboard(
  mode: FileSystemClipboard['mode'],
  itemIds: Array<SidebarItemId>,
  workspaceId: string,
  readModel: WorkspaceResourceReadModel<AnyItem>,
): FileSystemClipboard | null {
  if (itemIds.length === 0) return null
  const items = normalizeActiveItems(itemIds, readModel)
  return items.length === 0 ? null : { mode, workspaceId, itemIds: items.map((item) => item.id) }
}
