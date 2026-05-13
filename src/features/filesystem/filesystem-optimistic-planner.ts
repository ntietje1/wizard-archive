import { planCopyOperations } from 'convex/sidebarItems/filesystem/copyPlanner'
import { planMoveOperations } from 'convex/sidebarItems/filesystem/movePlanner'
import { validateCreateParentTarget } from 'convex/sidebarItems/validation/parent'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type {
  CopyFileSystemCommand,
  CreateFileSystemCommand,
  DeleteForeverFileSystemCommand,
  FileSystemCommand,
  MoveFileSystemCommand,
  RenameFileSystemCommand,
  RestoreFileSystemCommand,
  TrashFileSystemCommand,
} from 'convex/sidebarItems/filesystem/commands'
import type {
  ConflictDecision,
  ItemOperationConflict,
  MoveOperation,
} from 'convex/sidebarItems/filesystem/operationTypes'
import {
  buildOptimisticDeleteForeverPatches,
  buildOptimisticCreatePatches,
  buildOptimisticMovePatches,
  buildOptimisticRenamePatches,
  buildOptimisticTrashPatches,
} from './filesystem-optimistic-patches'
import type { OptimisticPatchSet } from './filesystem-optimistic-patches'
import type { SidebarCacheSnapshot } from './filesystem-cache-patches'
import type { FileSystemReadModel } from './filesystem-read-model'
import { getRestoreTargetParentId } from './filesystem-targets'
import type { SidebarOperationSurface } from './filesystem-targets'

type FileSystemOptimisticPlan =
  | ({ status: 'ready' } & OptimisticPatchSet)
  | { status: 'needsDecision'; conflicts: Array<ItemOperationConflict> }

type PlannerArgs = {
  command: FileSystemCommand
  decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  snapshot: SidebarCacheSnapshot
  readModel: FileSystemReadModel
  activeItemSurface: SidebarOperationSurface | null
  currentUserId: Id<'userProfiles'> | null
  campaignId: Id<'campaigns'>
  resolveOperationItems: (items: Array<AnySidebarItem>) => Array<AnySidebarItem>
}

type CommandPlannerArgs<TCommand extends FileSystemCommand> = Omit<PlannerArgs, 'command'> & {
  command: TCommand
}

function readyWithPatches(patches: OptimisticPatchSet) {
  return { status: 'ready' as const, ...patches }
}

function planCopy(args: CommandPlannerArgs<CopyFileSystemCommand>) {
  const loadedItems = args.readModel.getItems(args.command.itemIds)
  assertAllCommandItemsLoaded(args.command.itemIds, loadedItems)
  const items = args.resolveOperationItems(loadedItems)
  const plan = planCopyOperations({
    items,
    targetParentId: args.command.targetParentId,
    targetItems: args.readModel.getChildren(args.command.targetParentId),
    decisions: args.decisions,
    getChildren: args.readModel.getChildren,
  })
  if (plan.status === 'needs-decision')
    return { status: 'needsDecision' as const, conflicts: plan.conflicts }

  return readyWithPatches({ forwardPatches: [], inversePatches: [] })
}

function planMoveOrRestore(
  args: CommandPlannerArgs<MoveFileSystemCommand | RestoreFileSystemCommand>,
) {
  const groups = groupMoveItemsByTarget(args)
  const operations: Array<MoveOperation> = []
  const conflicts: Array<ItemOperationConflict> = []

  for (const [targetParentId, groupItems] of groups) {
    const plan = planMoveOperations({
      items: groupItems,
      targetParentId,
      targetItems: args.readModel.getChildren(targetParentId),
      decisions: args.decisions,
      getChildren: args.readModel.getChildren,
    })
    if (plan.status === 'needs-decision') {
      conflicts.push(...plan.conflicts)
      continue
    }
    operations.push(...plan.operations)
  }
  if (conflicts.length > 0) return { status: 'needsDecision' as const, conflicts }

  return readyWithPatches(buildOptimisticMovePatches(args.snapshot, operations))
}

function groupMoveItemsByTarget(
  args: CommandPlannerArgs<MoveFileSystemCommand | RestoreFileSystemCommand>,
) {
  const { command } = args
  const loadedItems = args.readModel.getItems(command.itemIds)
  assertAllCommandItemsLoaded(command.itemIds, loadedItems)
  const items = args.resolveOperationItems(loadedItems)
  const groups = new Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>()

  for (const item of items) {
    const targetParentId = resolveMoveTargetParentId(args)
    const groupItems = groups.get(targetParentId)
    if (groupItems) {
      groupItems.push(item)
    } else {
      groups.set(targetParentId, [item])
    }
  }

  return groups
}

function resolveMoveTargetParentId(
  args: CommandPlannerArgs<MoveFileSystemCommand | RestoreFileSystemCommand>,
) {
  if (args.command.type === 'move') return args.command.targetParentId
  return getRestoreTargetParentId(
    args.activeItemSurface,
    args.readModel.itemsById,
    args.command.targetParentId,
  )
}

function planTrash(args: CommandPlannerArgs<TrashFileSystemCommand>) {
  const loadedItems = args.readModel.getItems(args.command.itemIds)
  assertAllCommandItemsLoaded(args.command.itemIds, loadedItems)
  const items = args.resolveOperationItems(loadedItems)
  return readyWithPatches(
    buildOptimisticTrashPatches(args.snapshot, items, Date.now(), args.currentUserId),
  )
}

function planDeleteForever(args: CommandPlannerArgs<DeleteForeverFileSystemCommand>) {
  const loadedItems = args.readModel.getItems(args.command.itemIds)
  assertAllCommandItemsLoaded(args.command.itemIds, loadedItems)
  const items = args.resolveOperationItems(loadedItems)
  return readyWithPatches(buildOptimisticDeleteForeverPatches(args.snapshot, items))
}

function assertAllCommandItemsLoaded(
  itemIds: Array<Id<'sidebarItems'>>,
  items: Array<AnySidebarItem>,
): void {
  const loadedIds = new Set(items.map((item) => item._id))
  const missingIds = itemIds.filter((itemId) => !loadedIds.has(itemId))
  if (missingIds.length > 0) {
    throw new Error(`Filesystem command references missing sidebar items: ${missingIds.join(', ')}`)
  }
}

function planCreate(args: CommandPlannerArgs<CreateFileSystemCommand>) {
  const parent = validateCreateParentTarget(
    args.command.parentTarget,
    args.readModel.itemsById,
    args.readModel.childrenByParent,
  )
  if (!parent.valid) return readyWithPatches({ forwardPatches: [], inversePatches: [] })
  return readyWithPatches(
    buildOptimisticCreatePatches({
      command: args.command,
      parentId: parent.parentId,
      currentUserId: args.currentUserId,
      campaignId: args.campaignId,
    }),
  )
}

function planRename(args: CommandPlannerArgs<RenameFileSystemCommand>) {
  return readyWithPatches(buildOptimisticRenamePatches(args.snapshot, args.command))
}

export function planFileSystemOptimisticCommand(args: PlannerArgs): FileSystemOptimisticPlan {
  switch (args.command.type) {
    case 'copy':
      return planCopy({ ...args, command: args.command })
    case 'move':
    case 'restore':
      return planMoveOrRestore({ ...args, command: args.command })
    case 'trash':
      return planTrash({ ...args, command: args.command })
    case 'deleteForever':
      return planDeleteForever({ ...args, command: args.command })
    case 'create':
      return planCreate({ ...args, command: args.command })
    case 'rename':
      return planRename({ ...args, command: args.command })
    case 'emptyTrash':
      return readyWithPatches({ forwardPatches: [], inversePatches: [] })
  }
}
