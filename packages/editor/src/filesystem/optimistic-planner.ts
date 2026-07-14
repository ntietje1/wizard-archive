import { normalizeSelectedRoots } from './domain/selection-roots'
import { planTransferOperations } from './operation-contract'
import type {
  ResourceCommand,
  ResourceCreateCommand,
  ResourceCreateParentPlan,
  ResourceRenameCommand,
} from './transaction-contract'
import type { ResourcePatch } from './patch-contract'
import type { TransferOperation } from './operation-contract'
import {
  projectDeleteForeverRoots,
  projectMoveOperations,
  projectTrashRoots,
} from './domain/patch-projection'
import type { FileSystemOptimisticPreview } from './domain/lifecycle'
import { CREATE_PARENT_TARGET_KIND, canonicalizeResourceItemTitle } from '../workspace/items'
import type { AnyItem, WorkspaceResourceReadModel } from '../workspace/items'
import { planCreateParentTarget } from '../workspace/items/create-parent-target'
import { isTrashedSidebarItem } from '../workspace/items/status'
import type { SidebarItemId, UserProfileId } from '../../../../shared/common/ids'
import {
  buildOptimisticCreatePreview,
  buildOptimisticRenamePreview,
  expectedOptimisticCreateSlug,
} from './optimistic-patches'
import { resourcePatchRowFromCacheItem } from './cache-patches'
import type { SidebarCacheSnapshot } from './cache-patches'

type CopyFileSystemCommand = Extract<ResourceCommand, { type: 'copy' }>
type DeleteForeverFileSystemCommand = Extract<ResourceCommand, { type: 'deleteForever' }>
type MoveFileSystemCommand = Extract<ResourceCommand, { type: 'move' }>
type RestoreFileSystemCommand = Extract<ResourceCommand, { type: 'restore' }>
type TrashFileSystemCommand = Extract<ResourceCommand, { type: 'trash' }>

type FileSystemOptimisticPlan =
  | { status: 'ready'; preview: FileSystemOptimisticPreview }
  | { status: 'unavailable'; reason: 'resources_missing' }

type PlannerArgs = {
  command: ResourceCommand
  createParentPlan?: ResourceCreateParentPlan
  snapshot: SidebarCacheSnapshot
  readModel: WorkspaceResourceReadModel<AnyItem>
  activeItemSurface: { parentId: SidebarItemId | null } | null
  currentUserId: UserProfileId | null
  workspaceId: string
}

type CommandPlannerArgs<TCommand extends ResourceCommand> = Omit<PlannerArgs, 'command'> & {
  command: TCommand
}

function assertNever(value: never): never {
  throw new Error(`Unhandled filesystem command: ${JSON.stringify(value)}`)
}

function ready(
  patches: { forwardPatches: Array<ResourcePatch>; inversePatches: Array<ResourcePatch> } = {
    forwardPatches: [],
    inversePatches: [],
  },
): FileSystemOptimisticPlan {
  return {
    status: 'ready',
    preview: {
      receiptPatches: patches.forwardPatches,
      inversePatches: patches.inversePatches,
      optimisticIntents: [],
      rollbackIntents: [],
    },
  }
}

function unavailable(): FileSystemOptimisticPlan {
  return { status: 'unavailable', reason: 'resources_missing' }
}

function resolveCommandItems(
  readModel: WorkspaceResourceReadModel<AnyItem>,
  itemIds: Array<SidebarItemId>,
) {
  const items = readModel.getItems(itemIds)
  return items.length === itemIds.length ? items : null
}

function planCopy(args: CommandPlannerArgs<CopyFileSystemCommand>) {
  const loadedItems = resolveCommandItems(args.readModel, args.command.itemIds)
  if (!loadedItems) return unavailable()
  return ready()
}

function planMoveOrRestore(
  args: CommandPlannerArgs<MoveFileSystemCommand | RestoreFileSystemCommand>,
) {
  const loadedItems = resolveCommandItems(args.readModel, args.command.itemIds)
  if (!loadedItems) return unavailable()
  const groups = groupMoveItemsByTarget(args, loadedItems)
  const operations: Array<TransferOperation> = []

  for (const [targetParentId, groupItems] of groups) {
    operations.push(
      ...planTransferOperations({
        mode: 'move',
        items: groupItems,
        itemsById: args.readModel.itemsById,
        targetParentId,
      }),
    )
  }

  return ready(
    projectMoveOperations({
      activeItems: args.snapshot.sidebar.map(resourcePatchRowFromCacheItem),
      trashItems: args.snapshot.trash.map(resourcePatchRowFromCacheItem),
      operations,
      now: Date.now(),
      userId: args.currentUserId,
    }),
  )
}

function groupMoveItemsByTarget(
  args: CommandPlannerArgs<MoveFileSystemCommand | RestoreFileSystemCommand>,
  loadedItems: Array<AnyItem>,
) {
  const items = normalizeSelectedRoots(loadedItems, args.readModel.itemsById)
  const groups = new Map<SidebarItemId | null, Array<AnyItem>>()

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

function getRestoreTargetParentId(
  activeItemSurface: { parentId: SidebarItemId | null } | null,
  itemsMap: ReadonlyMap<SidebarItemId, AnyItem>,
  targetParentId?: SidebarItemId | null,
): SidebarItemId | null {
  const resolvedParentId =
    targetParentId === undefined ? (activeItemSurface?.parentId ?? null) : targetParentId
  if (!resolvedParentId) return null
  const targetParent = itemsMap.get(resolvedParentId)
  return targetParent && !isTrashedSidebarItem(targetParent) ? resolvedParentId : null
}

function planTrash(args: CommandPlannerArgs<TrashFileSystemCommand>) {
  const rootIds = resolveSelectedRootIds(args)
  if (!rootIds) return unavailable()
  return ready(
    projectTrashRoots(args.snapshot.sidebar.map(resourcePatchRowFromCacheItem), rootIds, {
      now: Date.now(),
      userId: args.currentUserId,
    }),
  )
}

function planDeleteForever(args: CommandPlannerArgs<DeleteForeverFileSystemCommand>) {
  const rootIds = resolveSelectedRootIds(args)
  if (!rootIds) return unavailable()
  return ready(
    projectDeleteForeverRoots(args.snapshot.trash.map(resourcePatchRowFromCacheItem), rootIds),
  )
}

function resolveSelectedRootIds(
  args: CommandPlannerArgs<TrashFileSystemCommand | DeleteForeverFileSystemCommand>,
) {
  const loadedItems = resolveCommandItems(args.readModel, args.command.itemIds)
  if (!loadedItems) return null
  const items = normalizeSelectedRoots(loadedItems, args.readModel.itemsById)
  return items.map((item) => item.id)
}

function planCreate(args: CommandPlannerArgs<ResourceCreateCommand>): FileSystemOptimisticPlan {
  const parentPlan =
    args.createParentPlan ??
    planCreateParentTarget(args.command.parentTarget, {
      getItemById: args.readModel.getItem,
      getActiveChildren: args.readModel.getActiveChildren,
    })
  if (!parentPlan) return ready()
  const parentId = getCreatePreviewParentId(parentPlan)
  if (parentId === undefined) return ready()
  const name = canonicalizeResourceItemTitle(args.command.name)
  const slug = expectedOptimisticCreateSlug(name, getReservedSlugs(args))
  return {
    status: 'ready',
    preview: buildOptimisticCreatePreview({
      command: args.command,
      parentId,
      currentUserId: args.currentUserId,
      workspaceId: args.workspaceId,
      name,
      slug,
    }),
  }
}

function getReservedSlugs(args: CommandPlannerArgs<ResourceCreateCommand>) {
  const slugs = new Set<string>()
  for (const item of args.readModel.itemsById.values()) {
    slugs.add(item.slug)
  }
  for (const item of args.snapshot.sidebar) {
    slugs.add(item.slug)
  }
  for (const item of args.snapshot.trash) {
    slugs.add(item.slug)
  }
  return slugs
}

function getCreatePreviewParentId(
  plan: NonNullable<ReturnType<typeof planCreateParentTarget>>,
): SidebarItemId | null | undefined {
  if (plan.kind === CREATE_PARENT_TARGET_KIND.direct) return plan.parentId
  const finalFolder = plan.folders[plan.folders.length - 1]
  if (!finalFolder) return null
  return finalFolder.kind === 'existing' ? finalFolder.id : undefined
}

function planRename(args: CommandPlannerArgs<ResourceRenameCommand>): FileSystemOptimisticPlan {
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
    case 'setResourceAudiencePermission':
    case 'setResourcesMemberPermission':
    case 'clearResourcesMemberPermission':
    case 'setFolderInheritShares':
    case 'setBlocksShareStatus':
    case 'setBlockMemberPermission':
    case 'toggleBookmarks':
      return ready()
  }
  return assertNever(args.command)
}
