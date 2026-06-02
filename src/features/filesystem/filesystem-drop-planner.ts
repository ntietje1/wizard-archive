import { CAMPAIGN_MEMBER_ROLE } from '~/features/campaigns/campaign-types'
import type { SidebarOperationRejectionCode } from 'shared/sidebar-items/filesystem/capabilities'
import { planFileSystemDropIntent } from 'shared/sidebar-items/filesystem/intent-planning'
import type { FileSystemDropOptions } from 'shared/sidebar-items/filesystem/intent-planning'
import type { FileSystemCommand } from 'shared/sidebar-items/filesystem/commands'
import type { Id } from 'convex/_generated/dataModel'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { DropPlanningContext } from '~/features/dnd/utils/drop-planning-context'
import { SIDEBAR_ROOT_DROP_TYPE, TRASH_DROP_ZONE_TYPE } from '~/features/dnd/utils/drop-target-data'
import type {
  ResolvedSidebarItemDropData,
  SidebarDropData,
} from '~/features/dnd/utils/drop-target-data'
import { assertNever } from '~/shared/utils/utils'

export type FileSystemGlobalDropRejectionReason =
  | 'not_folder'
  | 'circular'
  | 'no_permission'
  | 'missing_data'
  | 'trashed_folder'
  | 'dm_only'
  | 'trashed_item'
  | 'wrong_trash_state'
  | 'mixed_actions'

export type FileSystemGlobalDropTarget =
  | {
      type: 'trash'
    }
  | {
      type: 'root'
      label: string
    }
  | {
      type: 'folder'
      folder: AnySidebarItem
      ancestorIds?: Array<Id<'sidebarItems'>>
    }

type FileSystemGlobalDropCommand =
  | { status: 'noop' }
  | { status: 'blocked'; reason: FileSystemGlobalDropRejectionReason }
  | {
      status: 'ready'
      action: 'move' | 'copy' | 'restore' | 'trash'
      command: Extract<FileSystemCommand, { type: 'move' | 'copy' | 'restore' | 'trash' }>
      label: string
    }

export function resolveFileSystemDropTarget(
  dropTarget: SidebarDropData,
  ctx: DropPlanningContext,
): FileSystemGlobalDropTarget | null {
  switch (dropTarget.type) {
    case TRASH_DROP_ZONE_TYPE:
      return { type: 'trash' }
    case SIDEBAR_ROOT_DROP_TYPE:
      return { type: 'root', label: ctx.campaignName || 'Root' }
    case SIDEBAR_ITEM_TYPES.folders: {
      const folderTarget = dropTarget as ResolvedSidebarItemDropData
      return {
        type: 'folder',
        folder: folderTarget,
        ancestorIds: folderTarget.ancestorIds,
      }
    }
    default:
      return null
  }
}

function toDropRejectionReason(
  code: SidebarOperationRejectionCode,
): FileSystemGlobalDropRejectionReason {
  switch (code) {
    case 'no_source_permission':
    case 'no_target_permission':
      return 'no_permission'
    case 'dm_only':
      return 'dm_only'
    case 'circular':
    case 'missing_ancestor_ids':
      return 'circular'
    case 'trashed_folder':
      return 'trashed_folder'
    case 'trashed_item':
    case 'already_trashed':
      return 'trashed_item'
    case 'not_trashed':
      return 'wrong_trash_state'
    case 'not_found':
    case 'invalid_target':
      return 'missing_data'
    case 'not_folder':
      return 'not_folder'
    default:
      return assertNever(code)
  }
}

function targetLabel(target: Extract<FileSystemGlobalDropTarget, { type: 'root' | 'folder' }>) {
  if (target.type === 'root') return target.label
  return target.folder.name.trim() || 'Unnamed folder'
}

function itemCountLabel(count: number) {
  return count === 1 ? 'item' : `${count} items`
}

function toDropIntentTarget(target: FileSystemGlobalDropTarget) {
  if (target.type === 'trash') return target
  if (target.type === 'root')
    return { type: 'parent' as const, target: { parentId: null, parent: null } }
  return {
    type: 'parent' as const,
    target: {
      parentId: target.folder._id,
      parent: target.folder,
      ancestorIds: target.ancestorIds,
    },
  }
}

function labelForCommand(
  command: Extract<FileSystemCommand, { type: 'move' | 'copy' | 'restore' | 'trash' }>,
  target: FileSystemGlobalDropTarget,
) {
  const itemLabel = itemCountLabel(command.itemIds.length)
  if (command.type === 'trash') return `Move ${itemLabel} to "Trash"`
  if (target.type !== 'root' && target.type !== 'folder') return ''
  const label = targetLabel(target)
  if (command.type === 'copy') return `Copy ${itemLabel} to "${label}"`
  if (command.type === 'restore') return `Restore ${itemLabel} to "${label}"`
  return `Move ${itemLabel} to "${label}"`
}

export function resolveGlobalFileSystemDropCommand(
  items: Array<AnySidebarItem>,
  target: FileSystemGlobalDropTarget,
  ctx: { isDm: boolean },
  options: FileSystemDropOptions = {},
): FileSystemGlobalDropCommand {
  if (items.length === 0) return { status: 'noop' }

  const result = planFileSystemDropIntent({
    actor: { role: ctx.isDm ? CAMPAIGN_MEMBER_ROLE.DM : CAMPAIGN_MEMBER_ROLE.Player },
    items,
    target: toDropIntentTarget(target),
    options,
  })
  if (result.status === 'noop') return { status: 'noop' }
  if (result.status === 'blocked') {
    return {
      status: 'blocked',
      reason:
        result.reason === 'mixed_actions' ? result.reason : toDropRejectionReason(result.reason),
    }
  }

  switch (result.command.type) {
    case 'move':
    case 'copy':
    case 'restore':
    case 'trash':
      return {
        status: 'ready',
        action: result.command.type,
        command: result.command,
        label: labelForCommand(result.command, target),
      }
    default:
      return assertNever(result.command)
  }
}

export function fileSystemDropCommandFailureMessage(
  command: Extract<FileSystemGlobalDropCommand, { status: 'ready' }>,
): string {
  switch (command.action) {
    case 'move':
      return 'Failed to move items'
    case 'copy':
      return 'Failed to copy items'
    case 'restore':
      return 'Failed to restore items'
    case 'trash':
      return 'Failed to move items to trash'
    default:
      return assertNever(command.action)
  }
}
