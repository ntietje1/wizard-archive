import { planFileSystemDropIntent } from './domain/intent-planning'
import type {
  FileSystemDropOptions,
  FileSystemDropTargetIntent,
  FileSystemIntentCommand,
  FileSystemIntentCommandPlan,
  FileSystemIntentRejectionReason,
} from './domain/intent-planning'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type { AnyItem } from '../workspace/items'
import type { DropPlanningContext } from '../drag-drop/planning-context'
import { SIDEBAR_ROOT_DROP_TYPE, TRASH_DROP_ZONE_TYPE } from '../drag-drop/drop-target-data'
import type { ResolvedSidebarItemDropData, SidebarDropData } from '../drag-drop/drop-target-data'

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`)
}

type FileSystemGlobalDropCommand =
  | { status: 'noop' }
  | { status: 'blocked'; reason: FileSystemIntentRejectionReason }
  | { status: 'ready'; plan: FileSystemIntentCommandPlan }

export function resolveFileSystemDropTarget(
  dropTarget: SidebarDropData,
  ctx: DropPlanningContext,
): FileSystemDropTargetIntent | null {
  switch (dropTarget.type) {
    case TRASH_DROP_ZONE_TYPE:
      return { type: 'trash', label: 'Trash' }
    case SIDEBAR_ROOT_DROP_TYPE:
      return {
        type: 'parent',
        target: { parentId: null, parent: null },
        label: ctx.workspaceName || 'Root',
      }
    case RESOURCE_TYPES.folders: {
      const folderTarget = dropTarget as ResolvedSidebarItemDropData
      return {
        type: 'parent',
        target: {
          parentId: folderTarget.id,
          parent: folderTarget,
          ancestorIds: folderTarget.ancestorIds,
        },
        label: folderTarget.name.trim() || 'Unnamed folder',
      }
    }
    default:
      return null
  }
}

export function resolveGlobalFileSystemDropCommand(
  items: Array<AnyItem>,
  target: FileSystemDropTargetIntent,
  ctx: { canCreateRootItems: boolean; canManageFolders: boolean },
  options: FileSystemDropOptions = {},
): FileSystemGlobalDropCommand {
  if (items.length === 0) return { status: 'noop' }

  const result = planFileSystemDropIntent({
    actor: {
      canCreateRootItems: ctx.canCreateRootItems,
      canManageFolders: ctx.canManageFolders,
    },
    items,
    target,
    options,
  })
  if (result.status === 'noop') return { status: 'noop' }
  if (result.status === 'blocked') {
    return {
      status: 'blocked',
      reason: result.reason,
    }
  }

  return result
}

export function fileSystemDropCommandFailureMessage(command: FileSystemIntentCommand): string {
  switch (command.type) {
    case 'move':
      return 'Failed to move items'
    case 'copy':
      return 'Failed to copy items'
    case 'restore':
      return 'Failed to restore items'
    case 'trash':
      return 'Failed to move items to trash'
    default:
      return assertNever(command)
  }
}
