import { planCopyOperations } from 'convex/sidebarItems/filesystem/copyPlanner'
import { planMoveOperations } from 'convex/sidebarItems/filesystem/movePlanner'
import { normalizeSelectedRoots } from 'convex/sidebarItems/filesystem/selection'
import {
  projectDeleteForeverRoots,
  projectMoveOperations,
  projectTrashRoots,
} from 'convex/sidebarItems/filesystem/patchProjection'
import type { FileSystemDelta } from 'convex/sidebarItems/filesystem/receipts'
import {
  CREATE_PARENT_TARGET_KIND,
  validateCreateParentTarget,
} from 'convex/sidebarItems/validation/parent'
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
  buildOptimisticCreatePreview,
  buildOptimisticRenamePreview,
} from './filesystem-optimistic-patches'
import type { SidebarCacheSnapshot } from './filesystem-cache-patches'
import type { FileSystemReadModel } from 'convex/sidebarItems/filesystem/readModel'
import { getRestoreTargetParentId } from './filesystem-targets'
import type { SidebarOperationSurface } from './filesystem-targets'

type FileSystemOptimisticPlan =
  | { status: 'ready'; preview: FileSystemDelta }
  | { status: 'needsDecision'; conflicts: Array<ItemOperationConflict> }

type PlannerArgs = {
  command: FileSystemCommand
  decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
  snapshot: SidebarCacheSnapshot
  readModel: FileSystemReadModel<AnySidebarItem>
  activeItemSurface: SidebarOperationSurface | null
  currentUserId: Id<'userProfiles'> | null
  campaignId: Id<'campaigns'>
}

type CommandPlannerArgs<TCommand extends FileSystemCommand> = Omit<PlannerArgs, 'command'> & {
  command: TCommand
}

function ready(
  command: FileSystemCommand,
  patches: Pick<FileSystemDelta, 'forwardPatches' | 'inversePatches'> = {
    forwardPatches: [],
    inversePatches: [],
  },
): FileSystemOptimisticPlan {
  return {
    status: 'ready',
    preview: {
      command,
      events: [],
      receiptPatches: patches.forwardPatches,
      forwardPatches: patches.forwardPatches,
      inversePatches: patches.inversePatches,
      undoable: false,
    },
  }
}

function planCopy(args: CommandPlannerArgs<CopyFileSystemCommand>) {
  const loadedItems = args.readModel.requireItems(args.command.itemIds)
  const items = normalizeSelectedRoots(loadedItems, args.readModel.itemsById)
  const plan = planCopyOperations({
    items,
    itemsById: args.readModel.itemsById,
    targetParentId: args.command.targetParentId,
    targetItems: args.readModel.getActiveChildren(args.command.targetParentId),
    decisions: args.decisions,
    getChildren: args.readModel.getActiveChildren,
  })
  if (plan.status === 'needs-decision')
    return { status: 'needsDecision' as const, conflicts: plan.conflicts }

  return ready(args.command)
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
      itemsById: args.readModel.itemsById,
      targetParentId,
      targetItems: args.readModel.getActiveChildren(targetParentId),
      decisions: args.decisions,
      getChildren: args.readModel.getActiveChildren,
    })
    if (plan.status === 'needs-decision') {
      conflicts.push(...plan.conflicts)
      continue
    }
    operations.push(...plan.operations)
  }
  if (conflicts.length > 0) return { status: 'needsDecision' as const, conflicts }

  return ready(
    args.command,
    projectMoveOperations({
      activeItems: args.snapshot.sidebar,
      trashItems: args.snapshot.trash,
      operations,
      now: Date.now(),
    }),
  )
}

function groupMoveItemsByTarget(
  args: CommandPlannerArgs<MoveFileSystemCommand | RestoreFileSystemCommand>,
) {
  const { command } = args
  const loadedItems = args.readModel.requireItems(command.itemIds)
  const items = normalizeSelectedRoots(loadedItems, args.readModel.itemsById)
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
  const loadedItems = args.readModel.requireItems(args.command.itemIds)
  const items = normalizeSelectedRoots(loadedItems, args.readModel.itemsById)
  const rootIds = items.map((item) => item._id)
  return ready(
    args.command,
    projectTrashRoots(args.snapshot.sidebar, rootIds, {
      now: Date.now(),
      userId: args.currentUserId,
    }),
  )
}

function planDeleteForever(args: CommandPlannerArgs<DeleteForeverFileSystemCommand>) {
  const loadedItems = args.readModel.requireItems(args.command.itemIds)
  const items = normalizeSelectedRoots(loadedItems, args.readModel.itemsById)
  const rootIds = items.map((item) => item._id)
  return ready(args.command, projectDeleteForeverRoots(args.snapshot.trash, rootIds))
}

function planCreate(args: CommandPlannerArgs<CreateFileSystemCommand>): FileSystemOptimisticPlan {
  if (args.command.parentTarget.kind !== CREATE_PARENT_TARGET_KIND.direct) {
    return ready(args.command)
  }
  const parent = validateCreateParentTarget(
    args.command.parentTarget,
    args.readModel.itemsById,
    args.readModel.activeChildrenByParent,
  )
  if (!parent.valid) return ready(args.command)
  return {
    status: 'ready',
    preview: buildOptimisticCreatePreview({
      command: args.command,
      parentId: parent.parentId,
      currentUserId: args.currentUserId,
      campaignId: args.campaignId,
    }),
  }
}

function planRename(args: CommandPlannerArgs<RenameFileSystemCommand>): FileSystemOptimisticPlan {
  return { status: 'ready', preview: buildOptimisticRenamePreview(args.snapshot, args.command) }
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
      return ready(args.command)
  }
}
