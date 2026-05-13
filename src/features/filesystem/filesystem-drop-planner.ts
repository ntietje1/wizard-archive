import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import {
  evaluateCopy,
  evaluateMoveToParent,
  evaluateRestore,
  evaluateTrash,
} from 'convex/sidebarItems/filesystem/capabilities'
import type { SidebarOperationRejectionCode } from 'convex/sidebarItems/filesystem/capabilities'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { assertNever } from '~/shared/utils/utils'

type FileSystemDropRejectionReason =
  | 'not_folder'
  | 'circular'
  | 'no_permission'
  | 'missing_data'
  | 'trashed_folder'
  | 'dm_only'
  | 'trashed_item'
  | 'wrong_trash_state'

export type FileSystemGlobalDropRejectionReason =
  | FileSystemDropRejectionReason
  | 'mixed_actions'
  | 'unexpected_action'

export type FileSystemDropPlanningContext = {
  isDm: boolean
}

type FileSystemDropTarget =
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

export type FileSystemGlobalDropTarget =
  | FileSystemDropTarget
  | {
      type: 'open'
    }

export type FileSystemGlobalDropOptions = {
  copy?: boolean
}

type FileSystemDropPlan =
  | {
      type: 'operation'
      action: 'move' | 'copy' | 'restore' | 'trash'
      label: string
      parentId: Id<'sidebarItems'> | null
    }
  | {
      type: 'rejection'
      reason: FileSystemDropRejectionReason
    }
  | {
      type: 'noop'
    }

export type FileSystemGlobalDropCommand =
  | { status: 'noop' }
  | { status: 'blocked'; reason: FileSystemGlobalDropRejectionReason }
  | {
      status: 'ready'
      action: 'move' | 'copy' | 'restore'
      items: Array<AnySidebarItem>
      parentId: Id<'sidebarItems'> | null
      label: string
    }
  | {
      status: 'ready'
      action: 'trash'
      items: Array<AnySidebarItem>
      label: string
    }
  | {
      status: 'ready'
      action: 'open'
      item: AnySidebarItem
      label: string
    }

function actorFromFileSystemDropContext(ctx: FileSystemDropPlanningContext) {
  return { role: ctx.isDm ? CAMPAIGN_MEMBER_ROLE.DM : CAMPAIGN_MEMBER_ROLE.Player }
}

function toDropRejectionReason(code: SidebarOperationRejectionCode): FileSystemDropRejectionReason {
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
    case 'different_location':
      return 'not_folder'
    default:
      return assertNever(code)
  }
}

function rejectionFromCapability(
  result: ReturnType<typeof evaluateMoveToParent>,
): FileSystemDropPlan | null {
  return result.ok ? null : { type: 'rejection', reason: toDropRejectionReason(result.code) }
}

function parentSnapshotForTarget(target: FileSystemDropTarget) {
  if (target.type === 'root') {
    return { parentId: null, parent: null }
  }
  if (target.type === 'folder') {
    return {
      parentId: target.folder._id,
      parent: target.folder,
      ancestorIds: target.ancestorIds,
    }
  }
  return null
}

function targetLabel(target: Extract<FileSystemDropTarget, { type: 'root' | 'folder' }>) {
  if (target.type === 'root') return target.label
  return target.folder.name.trim() || 'Unnamed folder'
}

function planFileSystemDrop(
  item: AnySidebarItem,
  target: FileSystemDropTarget,
  ctx: FileSystemDropPlanningContext,
): FileSystemDropPlan {
  if (target.type === 'trash') {
    if (item.isTrashed) return { type: 'noop' }
    const capability = evaluateTrash(actorFromFileSystemDropContext(ctx), item)
    return (
      rejectionFromCapability(capability) ?? {
        type: 'operation',
        action: 'trash',
        label: 'Move to "Trash"',
        parentId: null,
      }
    )
  }

  if (target.type === 'folder' && item._id === target.folder._id) return { type: 'noop' }

  const parentSnapshot = parentSnapshotForTarget(target)
  if (!parentSnapshot) return { type: 'noop' }

  if (item.isTrashed) {
    const capability = evaluateRestore(actorFromFileSystemDropContext(ctx), item, parentSnapshot)
    return (
      rejectionFromCapability(capability) ?? {
        type: 'operation',
        action: 'restore',
        label: `Restore to "${targetLabel(target)}"`,
        parentId: parentSnapshot.parentId,
      }
    )
  }

  if (item.parentId === parentSnapshot.parentId) return { type: 'noop' }

  const capability = evaluateMoveToParent(actorFromFileSystemDropContext(ctx), item, parentSnapshot)
  return (
    rejectionFromCapability(capability) ?? {
      type: 'operation',
      action: 'move',
      label: `Move to "${targetLabel(target)}"`,
      parentId: parentSnapshot.parentId,
    }
  )
}

function planFileSystemCopyDrop(
  item: AnySidebarItem,
  target: Extract<FileSystemDropTarget, { type: 'root' | 'folder' }>,
  ctx: FileSystemDropPlanningContext,
): FileSystemDropPlan {
  const parentSnapshot = parentSnapshotForTarget(target)
  if (!parentSnapshot) return { type: 'noop' }

  const capability = evaluateCopy(actorFromFileSystemDropContext(ctx), item, parentSnapshot)
  return (
    rejectionFromCapability(capability) ?? {
      type: 'operation',
      action: 'copy',
      label: `Copy to "${targetLabel(target)}"`,
      parentId: parentSnapshot.parentId,
    }
  )
}

function isMoveLikeAction(action: string): action is 'move' | 'restore' {
  return action === 'move' || action === 'restore'
}

function isParentDropTarget(
  target: FileSystemGlobalDropTarget,
): target is Extract<FileSystemDropTarget, { type: 'root' | 'folder' }> {
  return target.type === 'root' || target.type === 'folder'
}

function resolveMoveLikeDropCommand(
  items: Array<AnySidebarItem>,
  target: FileSystemGlobalDropTarget,
  ctx: FileSystemDropPlanningContext,
): FileSystemGlobalDropCommand | null {
  if (!isParentDropTarget(target)) return null

  const operations: Array<{
    item: AnySidebarItem
    action: 'move' | 'restore'
    parentId: Id<'sidebarItems'> | null
    label: string
  }> = []

  for (const item of items) {
    const plan = planFileSystemDrop(item, target, ctx)
    if (plan.type === 'rejection') return { status: 'blocked', reason: plan.reason }
    if (plan.type === 'noop') continue
    if (!isMoveLikeAction(plan.action)) return null
    operations.push({
      item,
      action: plan.action,
      parentId: plan.parentId,
      label: plan.label,
    })
  }

  if (operations.length === 0) return { status: 'noop' }

  const first = operations[0]
  if (!first) return { status: 'noop' }
  if (operations.some((operation) => operation.action !== first.action)) {
    return { status: 'blocked', reason: 'mixed_actions' }
  }

  return {
    status: 'ready',
    action: first.action,
    items: operations.map((operation) => operation.item),
    parentId: first.parentId,
    label: first.label,
  }
}

function resolveCopyDropCommand(
  items: Array<AnySidebarItem>,
  target: FileSystemGlobalDropTarget,
  ctx: FileSystemDropPlanningContext,
): FileSystemGlobalDropCommand {
  if (!isParentDropTarget(target)) return { status: 'noop' }

  let label = ''
  for (const item of items) {
    const plan = planFileSystemCopyDrop(item, target, ctx)
    if (plan.type === 'rejection') return { status: 'blocked', reason: plan.reason }
    if (plan.type !== 'operation') return { status: 'noop' }
    label = plan.label
  }

  return {
    status: 'ready',
    action: 'copy',
    items,
    parentId: target.type === 'folder' ? target.folder._id : null,
    label,
  }
}

function resolveTrashDropCommand(
  items: Array<AnySidebarItem>,
  target: FileSystemGlobalDropTarget,
  ctx: FileSystemDropPlanningContext,
): FileSystemGlobalDropCommand {
  if (target.type !== 'trash') return { status: 'noop' }

  const trashableItems: Array<AnySidebarItem> = []
  let label = ''
  for (const item of items) {
    const plan = planFileSystemDrop(item, target, ctx)
    if (plan.type === 'rejection') return { status: 'blocked', reason: plan.reason }
    if (plan.type === 'noop') continue
    if (plan.action !== 'trash') return { status: 'blocked', reason: 'unexpected_action' }
    trashableItems.push(item)
    label = plan.label
  }

  if (trashableItems.length === 0) return { status: 'noop' }
  return { status: 'ready', action: 'trash', items: trashableItems, label }
}

function resolveOpenDropCommand(
  items: Array<AnySidebarItem>,
  target: FileSystemGlobalDropTarget,
): FileSystemGlobalDropCommand {
  if (target.type !== 'open') return { status: 'noop' }
  const item = items[0]
  return item
    ? { status: 'ready', action: 'open', item, label: 'Open in editor' }
    : { status: 'noop' }
}

export function resolveGlobalFileSystemDropCommand(
  items: Array<AnySidebarItem>,
  target: FileSystemGlobalDropTarget,
  ctx: FileSystemDropPlanningContext,
  options: FileSystemGlobalDropOptions = {},
): FileSystemGlobalDropCommand {
  if (items.length === 0) return { status: 'noop' }

  if (target.type === 'trash') return resolveTrashDropCommand(items, target, ctx)
  if (options.copy) return resolveCopyDropCommand(items, target, ctx)

  const moveLikeCommand = resolveMoveLikeDropCommand(items, target, ctx)
  if (moveLikeCommand) return moveLikeCommand

  return resolveOpenDropCommand(items, target)
}

export function fileSystemDropCommandFailureMessage(
  command: Extract<FileSystemGlobalDropCommand, { status: 'ready' }>,
) {
  switch (command.action) {
    case 'move':
      return 'Failed to move items'
    case 'copy':
      return 'Failed to copy items'
    case 'restore':
      return 'Failed to restore items'
    case 'trash':
      return 'Failed to move items to trash'
    case 'open':
      return 'Failed to open item'
    default:
      return assertNever(command)
  }
}
