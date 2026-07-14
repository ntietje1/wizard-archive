import type { ResourceId } from '../../resources/domain-id'
import type { AnyItem } from '../items'

import type { MaybePromise } from '../../../../../shared/common/async'
import { getSidebarFilesystemCapabilities } from '../../filesystem/capabilities'
import { resolveGlobalFileSystemDropCommand } from '../../filesystem/drop-planner'
import type { FileSystemPasteTargetInput } from '../../filesystem/item-operation-contracts'
import type { FilesystemContextMenuActionTarget } from './filesystem-actions'
import type { ResourceCommandResult } from '../../filesystem/transaction-contract'
import type {
  FileSystemDropTargetIntent,
  FileSystemIntentCommand,
} from '../../filesystem/domain/intent-planning'

interface WorkspaceFilesystemContextMenuSource {
  catalog: {
    getKnownItemById: (itemId: ResourceId) => AnyItem | null
    getVisibleAncestors: (itemId: ResourceId) => ReadonlyArray<AnyItem>
  }
  operations: {
    canPasteIntoTarget: (input: FileSystemPasteTargetInput) => boolean
    executeDropCommand: (command: FileSystemIntentCommand) => MaybePromise<unknown>
    pasteIntoTarget: (input: FileSystemPasteTargetInput) => MaybePromise<ResourceCommandResult>
    requestDeleteItemsForever: (itemIds: Array<ResourceId>) => MaybePromise<void>
    requestEmptyTrash: () => MaybePromise<void>
    restoreItems: (
      itemIds: Array<ResourceId>,
      targetParentId: ResourceId | null,
    ) => MaybePromise<unknown>
    trashItems: (itemIds: Array<ResourceId>) => MaybePromise<unknown>
  }
  permissions: {
    canCreateItems: boolean
    canEmptyTrash: boolean
    canManageFolders: boolean
  }
}

export function createWorkspaceFilesystemContextMenuTarget(
  filesystem: WorkspaceFilesystemContextMenuSource,
): FilesystemContextMenuActionTarget {
  const { operations, permissions } = filesystem
  const actor = {
    canCreateRootItems: permissions.canCreateItems,
    canManageFolders: permissions.canManageFolders,
  }

  return {
    canDeleteItemsForever: (items) =>
      getSidebarFilesystemCapabilities(actor, items).canDeleteForever,
    canDuplicateItems: (items) => canDuplicateItems(filesystem.catalog, actor, items),
    canEmptyTrash: permissions.canEmptyTrash,
    canPasteIntoTarget: operations.canPasteIntoTarget,
    canRestoreItems: (items) => getSidebarFilesystemCapabilities(actor, items).canRestore,
    canTrashItems: (items) => getSidebarFilesystemCapabilities(actor, items).canTrash,
    duplicateItems: async (items) => {
      const commands = groupItemsByParent(items).map((group) => {
        const target = resolveDuplicateDropTargetOrThrow(filesystem.catalog, group.parentId)
        const command = resolveGlobalFileSystemDropCommand(group.items, target, actor, {
          copy: true,
        })
        if (command.status !== 'ready') {
          throw new Error(
            command.status === 'blocked'
              ? `Unable to duplicate items: ${command.reason}`
              : 'Unable to duplicate items',
          )
        }
        return command.plan.command
      })
      await Promise.all(commands.map((command) => operations.executeDropCommand(command)))
    },
    pasteIntoTarget: (input) => operations.pasteIntoTarget(input),
    requestDeleteItemsForever: async (items) => {
      await operations.requestDeleteItemsForever(getItemIds(items))
    },
    requestEmptyTrash: operations.requestEmptyTrash,
    restoreItems: async (items, targetParentId) => {
      await operations.restoreItems(getItemIds(items), targetParentId)
    },
    trashItems: async (items) => {
      await operations.trashItems(getItemIds(items))
    },
  }
}

function canDuplicateItems(
  catalog: WorkspaceFilesystemContextMenuSource['catalog'],
  actor: { canCreateRootItems: boolean; canManageFolders: boolean },
  items: Array<AnyItem>,
) {
  if (items.length === 0) return false

  return groupItemsByParent(items).every((group) => {
    const target = resolveDuplicateDropTarget(catalog, group.parentId)
    if (!target) return false
    const command = resolveGlobalFileSystemDropCommand(group.items, target, actor, { copy: true })
    return command.status === 'ready' && command.plan.command.type === 'copy'
  })
}

function groupItemsByParent(items: Array<AnyItem>): Array<{
  parentId: ResourceId | null
  items: Array<AnyItem>
}> {
  const groups = new Map<ResourceId | null, Array<AnyItem>>()

  for (const item of items) {
    const parentId = item.parentId ?? null
    const groupItems = groups.get(parentId)
    if (groupItems) {
      groupItems.push(item)
    } else {
      groups.set(parentId, [item])
    }
  }

  return Array.from(groups, ([parentId, groupItems]) => ({
    parentId,
    items: groupItems,
  }))
}

function getItemIds(items: Array<AnyItem>): Array<ResourceId> {
  return items.map((item) => item.id)
}

function resolveDuplicateDropTarget(
  catalog: WorkspaceFilesystemContextMenuSource['catalog'],
  targetParentId: ResourceId | null,
): FileSystemDropTargetIntent | null {
  if (targetParentId === null) {
    return { type: 'parent', target: { parentId: null, parent: null }, label: 'Root' }
  }
  const folder = catalog.getKnownItemById(targetParentId)
  if (!folder) return null
  return {
    type: 'parent',
    target: {
      parentId: folder.id,
      parent: folder,
      ancestorIds: catalog.getVisibleAncestors(folder.id).map((ancestor) => ancestor.id),
    },
    label: folder.name.trim() || 'Unnamed folder',
  }
}

function resolveDuplicateDropTargetOrThrow(
  catalog: WorkspaceFilesystemContextMenuSource['catalog'],
  targetParentId: ResourceId | null,
): FileSystemDropTargetIntent {
  const target = resolveDuplicateDropTarget(catalog, targetParentId)
  if (!target) throw new Error(`Missing duplicate target parent ${targetParentId}`)
  return target
}
