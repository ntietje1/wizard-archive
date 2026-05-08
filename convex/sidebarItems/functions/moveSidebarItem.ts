import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import {
  findUniqueSidebarItemSlug,
  validateSidebarMove,
  validateSidebarParentChange,
} from '../validation/orchestration'
import { requireItemAccess } from '../validation/access'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { resyncNoteLinksForNotes } from '../../links/functions/resyncNoteLinksForNotes'
import { getSidebarItemsByParent } from './getSidebarItemsByParent'
import { deduplicateName } from './defaultItemName'
import { planMoveOperations } from '../operations/planner'
import { collectSidebarChildrenMap } from '../operations/childrenMap'
import { normalizeTopLevelSelectedItems } from '../operations/selection'
import { trashTree, restoreTreeDescendants } from './treeOperations'
import { getSidebarItem } from './getSidebarItem'
import { collectDescendants } from './collectDescendants'
import { evaluateRestore, evaluateTrash } from '../operations/capabilities'
import { assertSidebarOperationAllowed } from './operationCapability'
import { toDecisionRecord } from './operationDecisions'
import type { OperationDecision } from './operationDecisions'
import type { SidebarItemLocation } from '../types/baseTypes'
import type { AnySidebarItem, AnySidebarItemRow } from '../types/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import { assertSidebarItemName } from '../validation/name'
import type { SidebarItemName } from '../validation/name'
import type { SidebarItemSlug } from '../validation/slug'
import type { MoveOperation } from '../operations/types'

const clearDeletion = { deletionTime: null, deletedBy: null }

type MoveMergeFolderOperation = Extract<MoveOperation, { action: 'mergeFolder' }>
export type MoveSidebarItemsAction = 'move' | 'restore' | 'trash'

export const MOVE_OPERATION_ACTION = {
  move: 'move',
  skip: 'skip',
  replace: 'replace',
  mergeFolder: 'mergeFolder',
} as const

const MAX_SIDEBAR_MOVE_DEPTH = 50

async function resyncRelativeLinksForMovedItems(
  ctx: CampaignMutationCtx,
  {
    item,
    location,
  }: {
    item: AnySidebarItemRow
    location: SidebarItemLocation
  },
): Promise<void> {
  if (item.type === SIDEBAR_ITEM_TYPES.notes) {
    await resyncNoteLinksForNotes(ctx, { noteIds: [item._id] })
    return
  }

  if (item.type !== SIDEBAR_ITEM_TYPES.folders) {
    return
  }

  const descendants = await collectDescendants(ctx, {
    campaignId: item.campaignId,
    location,
    folderId: item._id,
  })
  const descendantNoteIds = descendants
    .filter((descendant) => descendant.type === SIDEBAR_ITEM_TYPES.notes)
    .map((descendant) => descendant._id)

  await resyncNoteLinksForNotes(ctx, { noteIds: descendantNoteIds })
}

/**
 * Resolves name/slug conflicts for an item being restored.
 * Returns a patch object with the unique name/slug if they differ from current.
 */
async function resolveRestoreConflicts(
  ctx: CampaignMutationCtx,
  item: AnySidebarItemRow,
): Promise<{ name?: SidebarItemName; slug?: SidebarItemSlug }> {
  const siblings = await getSidebarItemsByParent(ctx, {
    parentId: item.parentId,
  })
  const otherNames = siblings.filter((s) => s._id !== item._id).map((s) => s.name)

  const uniqueName = deduplicateName(item.name, otherNames) as SidebarItemName
  const uniqueSlug = await findUniqueSidebarItemSlug(ctx, {
    itemId: item._id,
    name: uniqueName,
  })

  const patch: { name?: SidebarItemName; slug?: SidebarItemSlug } = {}
  if (uniqueName !== item.name) patch.name = uniqueName
  if (uniqueSlug !== item.slug) patch.slug = uniqueSlug
  return patch
}

async function loadMovableSource(ctx: CampaignMutationCtx, itemId: Id<'sidebarItems'>) {
  const itemFromDb = await getSidebarItem(ctx, itemId)
  return await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
}

function validateSingleMoveIntent({
  isRelocating,
  isTrashing,
  isRestoring,
}: {
  isRelocating: boolean
  isTrashing: boolean
  isRestoring: boolean
}) {
  if (isRelocating && !isTrashing && !isRestoring) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'This move is not supported')
  }
}

async function executeTrash(ctx: CampaignMutationCtx, item: AnySidebarItem) {
  assertSidebarOperationAllowed(evaluateTrash({ role: ctx.membership.role }, item))

  await trashTree(ctx, item, {
    deletionTime: Date.now(),
    deletedBy: ctx.membership.userId,
  })

  await logEditHistory(ctx, {
    itemId: item._id,
    itemType: item.type,
    action: EDIT_HISTORY_ACTION.trashed,
  })
}

async function executeRestore(
  ctx: CampaignMutationCtx,
  {
    item,
    location,
    parentId,
    name,
  }: {
    item: AnySidebarItem
    location: SidebarItemLocation
    parentId?: Id<'sidebarItems'> | null
    name?: string
  },
) {
  const restoreParentId = parentId ?? null
  const requestedName = name ? assertSidebarItemName(name) : null
  const restoreParent =
    restoreParentId === null
      ? null
      : await requireItemAccess(ctx, {
          rawItem: await getSidebarItem(ctx, restoreParentId),
          requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
        })
  assertSidebarOperationAllowed(
    evaluateRestore({ role: ctx.membership.role }, item, {
      parentId: restoreParentId,
      parent: restoreParent,
      siblings: [],
    }),
  )

  await validateSidebarParentChange(ctx, {
    item: { ...item, location },
    newParentId: restoreParentId,
  })

  const itemForRestore = { ...item, parentId: restoreParentId }
  if (requestedName) {
    await validateSidebarMove(ctx, {
      item: { ...item, location },
      newParentId: restoreParentId,
      name: requestedName,
    })
  }
  const conflictPatch = requestedName
    ? {
        name: requestedName,
        slug: await findUniqueSidebarItemSlug(ctx, {
          itemId: item._id,
          name: requestedName,
        }),
      }
    : await resolveRestoreConflicts(ctx, itemForRestore)

  await ctx.db.patch('sidebarItems', item._id, {
    ...clearDeletion,
    ...conflictPatch,
    location,
    parentId: restoreParentId,
  })

  if (item.type === SIDEBAR_ITEM_TYPES.folders) {
    await restoreTreeDescendants(ctx, item, location)
  }

  await logEditHistory(ctx, {
    itemId: item._id,
    itemType: item.type,
    action: EDIT_HISTORY_ACTION.restored,
  })

  await resyncRelativeLinksForMovedItems(ctx, {
    item,
    location,
  })
}

async function executeParentMove(
  ctx: CampaignMutationCtx,
  {
    item,
    parentId,
    name,
  }: {
    item: AnySidebarItem
    parentId: Id<'sidebarItems'> | null
    name?: string
  },
) {
  const requestedName = name ? assertSidebarItemName(name) : null
  await validateSidebarMove(ctx, {
    item,
    newParentId: parentId,
    name: requestedName ?? undefined,
  })

  const oldParent = item.parentId ? await ctx.db.get('sidebarItems', item.parentId) : null
  const newParent = parentId ? await ctx.db.get('sidebarItems', parentId) : null
  const renamePatch =
    requestedName && requestedName !== item.name
      ? {
          name: requestedName,
          slug: await findUniqueSidebarItemSlug(ctx, {
            itemId: item._id,
            name: requestedName,
          }),
        }
      : {}

  await ctx.db.patch('sidebarItems', item._id, {
    parentId,
    ...renamePatch,
    updatedTime: Date.now(),
    updatedBy: ctx.membership.userId,
  })

  await logEditHistory(ctx, {
    itemId: item._id,
    itemType: item.type,
    action: EDIT_HISTORY_ACTION.moved,
    metadata: {
      from: oldParent?.name ?? null,
      to: newParent?.name ?? null,
    },
  })

  await resyncRelativeLinksForMovedItems(ctx, {
    item,
    location: item.location,
  })
}

export async function moveSidebarItem(
  ctx: CampaignMutationCtx,
  {
    itemId,
    location,
    parentId,
    name,
  }: {
    itemId: Id<'sidebarItems'>
    location?: SidebarItemLocation
    parentId?: Id<'sidebarItems'> | null
    name?: string
  },
): Promise<Id<'sidebarItems'>> {
  const item = await loadMovableSource(ctx, itemId)

  const isRelocating = location !== undefined && location !== item.location
  const isTrashing = isRelocating && location === SIDEBAR_ITEM_LOCATION.trash
  const isRestoring = isRelocating && item.location === SIDEBAR_ITEM_LOCATION.trash
  const isMoving = parentId !== undefined

  validateSingleMoveIntent({ isRelocating, isTrashing, isRestoring })

  if (isTrashing) {
    await executeTrash(ctx, item)
  } else if (isRestoring) {
    if (location === undefined)
      throw new Error('Invariant: location must be defined when restoring')
    await executeRestore(ctx, { item, location, parentId, name })
  } else if (isMoving) {
    await executeParentMove(ctx, { item, parentId, name })
  }

  return item._id
}

async function collectMoveChildrenMap(
  ctx: CampaignMutationCtx,
  folders: Array<Pick<AnySidebarItem, '_id' | 'location'>>,
) {
  const folderLocations = new Map(folders.map((folder) => [folder._id, folder.location]))

  return await collectSidebarChildrenMap({
    rootFolderIds: folders.map((folder) => folder._id),
    maxDepth: MAX_SIDEBAR_MOVE_DEPTH,
    getChildren: async (parentId) => {
      const location = folderLocations.get(parentId) ?? SIDEBAR_ITEM_LOCATION.sidebar
      const children = await getSidebarItemRowsByParentLocation(ctx, {
        parentId,
        location,
      })
      for (const child of children) {
        if (child.type === SIDEBAR_ITEM_TYPES.folders) {
          folderLocations.set(child._id, child.location)
        }
      }
      return children
    },
    onDepthExceeded: () => {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max sidebar move planning depth exceeded')
    },
  })
}

async function getSidebarItemRowsByParentLocation(
  ctx: CampaignMutationCtx,
  {
    parentId,
    location,
  }: {
    parentId: Id<'sidebarItems'>
    location: SidebarItemLocation
  },
): Promise<Array<AnySidebarItemRow>> {
  return await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_location_parent_name', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('location', location).eq('parentId', parentId),
    )
    .collect()
}

async function executeMoveOperations(
  ctx: CampaignMutationCtx,
  operations: Array<MoveOperation>,
): Promise<Array<Id<'sidebarItems'>>> {
  const movedIds: Array<Id<'sidebarItems'>> = []

  for (const operation of operations) {
    if (operation.action === MOVE_OPERATION_ACTION.skip) continue
    const movedId = await executeMoveOperation(ctx, operation)
    if (movedId) movedIds.push(movedId)
  }

  return movedIds
}

async function executeMoveOperation(
  ctx: CampaignMutationCtx,
  operation: MoveOperation,
): Promise<Id<'sidebarItems'> | null> {
  if (operation.action === MOVE_OPERATION_ACTION.skip) return null

  const source = await loadMovableSource(ctx, operation.sourceItemId)

  if (operation.action === MOVE_OPERATION_ACTION.mergeFolder) {
    return await executeMergeFolderMove(ctx, source, operation)
  }

  if (operation.action === MOVE_OPERATION_ACTION.replace) {
    await trashMoveReplacement(ctx, operation.destinationItemId)
  }

  if (source.location === SIDEBAR_ITEM_LOCATION.trash) {
    await executeRestore(ctx, {
      item: source,
      parentId: operation.targetParentId,
      name: operation.name,
      location: SIDEBAR_ITEM_LOCATION.sidebar,
    })
  } else {
    await executeParentMove(ctx, {
      item: source,
      parentId: operation.targetParentId,
      name: operation.name,
    })
  }
  return source._id
}

async function executeMergeFolderMove(
  ctx: CampaignMutationCtx,
  source: AnySidebarItem,
  operation: MoveMergeFolderOperation,
): Promise<Id<'sidebarItems'>> {
  if (source.type !== SIDEBAR_ITEM_TYPES.folders || !operation.destinationItemId) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only folders can be merged')
  }

  const rawDestination = await getSidebarItem(ctx, operation.destinationItemId)
  const destination = await requireItemAccess(ctx, {
    rawItem: rawDestination,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  if (destination.type !== SIDEBAR_ITEM_TYPES.folders) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Destination folder not found')
  }

  const remainingChildren = await getSidebarItemsByParent(ctx, { parentId: source._id })
  if (remainingChildren.length === 0) {
    await executeTrash(ctx, source)
  }
  return destination._id
}

async function trashMoveReplacement(
  ctx: CampaignMutationCtx,
  destinationItemId: Id<'sidebarItems'> | undefined,
) {
  if (!destinationItemId) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Replace requires a destination item')
  }

  const rawDestination = await getSidebarItem(ctx, destinationItemId)
  const destination = await requireItemAccess(ctx, {
    rawItem: rawDestination,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  if (destination.type === SIDEBAR_ITEM_TYPES.folders) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Folders are merged instead of replaced')
  }

  await executeTrash(ctx, destination)
}

async function loadMovableSources(
  ctx: CampaignMutationCtx,
  sourceItemIds: Array<Id<'sidebarItems'>>,
) {
  return await Promise.all(
    sourceItemIds.map((sourceItemId) => loadMovableSource(ctx, sourceItemId)),
  )
}

async function normalizeOperationRoots(
  ctx: CampaignMutationCtx,
  sourceItems: Array<AnySidebarItem>,
) {
  const folders = sourceItems.filter((item) => item.type === SIDEBAR_ITEM_TYPES.folders)
  const childrenMap = await collectMoveChildrenMap(ctx, folders)
  const allItems = new Map<Id<'sidebarItems'>, Pick<AnySidebarItem, '_id' | 'parentId'>>()

  for (const sourceItem of sourceItems) {
    allItems.set(sourceItem._id, sourceItem)
  }
  for (const children of childrenMap.values()) {
    for (const child of children) {
      allItems.set(child._id, child)
    }
  }

  return normalizeTopLevelSelectedItems(sourceItems, allItems)
}

async function trashSidebarItems(
  ctx: CampaignMutationCtx,
  sourceItems: Array<AnySidebarItem>,
): Promise<Array<Id<'sidebarItems'>>> {
  const rootItems = await normalizeOperationRoots(ctx, sourceItems)
  const movedIds: Array<Id<'sidebarItems'>> = []

  for (const item of rootItems) {
    if (item.location === SIDEBAR_ITEM_LOCATION.trash) continue
    await executeTrash(ctx, item)
    movedIds.push(item._id)
  }

  return movedIds
}

function assertRestoreActionSources(sourceItems: Array<AnySidebarItem>) {
  const invalidItem = sourceItems.find((item) => item.location !== SIDEBAR_ITEM_LOCATION.trash)
  if (!invalidItem) return

  throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only trashed items can be restored')
}

export async function moveSidebarItems(
  ctx: CampaignMutationCtx,
  {
    sourceItemIds,
    targetParentId,
    action = 'move',
    decisions,
  }: {
    sourceItemIds: Array<Id<'sidebarItems'>>
    targetParentId: Id<'sidebarItems'> | null
    action?: MoveSidebarItemsAction
    decisions?: Array<OperationDecision>
  },
): Promise<Array<Id<'sidebarItems'>>> {
  const sourceItems = await loadMovableSources(ctx, sourceItemIds)

  if (action === 'trash') {
    return await trashSidebarItems(ctx, sourceItems)
  }

  if (action === 'restore') {
    assertRestoreActionSources(sourceItems)
  }

  const targetItems = await getSidebarItemsByParent(ctx, { parentId: targetParentId })
  const folders = [...sourceItems, ...targetItems].filter(
    (item) => item.type === SIDEBAR_ITEM_TYPES.folders,
  )
  const childrenMap = await collectMoveChildrenMap(ctx, folders)
  const plan = planMoveOperations({
    items: sourceItems,
    targetParentId,
    targetItems,
    decisions: toDecisionRecord(decisions),
    getChildren: (parentId) => childrenMap.get(parentId) ?? [],
  })

  if (plan.status === 'cancelled') return []
  if (plan.status === 'needs-decision') {
    const conflictSummary = plan.conflicts
      .map((conflict) => `${conflict.sourceName} -> ${conflict.destinationName}`)
      .join(', ')
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Operation requires conflict decisions: ${conflictSummary}`,
    )
  }

  return await executeMoveOperations(ctx, plan.operations)
}
