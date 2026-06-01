import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemCommand } from 'shared/sidebar-items/filesystem/commands'
import type { FileSystemReadModel } from 'shared/sidebar-items/filesystem/read-model'
import { normalizeSelectedRoots } from 'shared/sidebar-items/filesystem/selection'
import { isActiveSidebarItem } from 'shared/sidebar-items/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { FileSystemClipboard } from './filesystem-clipboard-store'
import { getPasteTargetParentId } from './filesystem-targets'

type SidebarOperationSurface = {
  parentId: Id<'sidebarItems'> | null
}

function normalizeActiveItems(
  itemIds: Array<Id<'sidebarItems'>>,
  readModel: FileSystemReadModel<AnySidebarItem>,
) {
  return normalizeSelectedRoots(
    readModel.getItems(itemIds).filter(isActiveSidebarItem),
    readModel.itemsById,
  )
}

export function createFileSystemDuplicateCommand(
  itemIds: Array<Id<'sidebarItems'>>,
  readModel: FileSystemReadModel<AnySidebarItem>,
): FileSystemCommand | null {
  const items = normalizeActiveItems(itemIds, readModel)
  if (items.length === 0) return null

  const [firstItem] = items
  const targetParentId = items.every((item) => item.parentId === firstItem.parentId)
    ? firstItem.parentId
    : null
  return { type: 'copy', itemIds: items.map((item) => item._id), targetParentId }
}

export function resolveFileSystemClipboardCommand({
  clipboard,
  campaignId,
  activeItemSurface,
  targetParentId,
  readModel,
}: {
  clipboard: FileSystemClipboard | null
  campaignId: Id<'campaigns'> | null | undefined
  activeItemSurface: SidebarOperationSurface | null
  targetParentId?: Id<'sidebarItems'> | null
  readModel: FileSystemReadModel<AnySidebarItem>
}): { command: FileSystemCommand | null; clearClipboard: boolean } {
  if (!campaignId || !clipboard || clipboard.campaignId !== campaignId) {
    return { command: null, clearClipboard: false }
  }

  const resolvedTargetParentId = getPasteTargetParentId(activeItemSurface, targetParentId)
  const items = normalizeSelectedRoots(
    readModel.getItems(Array.from(clipboard.itemIds)),
    readModel.itemsById,
  )
  if (items.length === 0) return { command: null, clearClipboard: false }

  const itemIds = items.map((item) => item._id)
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
  itemIds: Array<Id<'sidebarItems'>>,
  campaignId: Id<'campaigns'> | null | undefined,
  readModel: FileSystemReadModel<AnySidebarItem>,
): FileSystemClipboard | null {
  if (!campaignId || itemIds.length === 0) return null
  const items = normalizeActiveItems(itemIds, readModel)
  return items.length === 0 ? null : { mode, campaignId, itemIds: items.map((item) => item._id) }
}
