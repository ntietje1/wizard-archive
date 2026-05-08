import { ERROR_CODE, throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
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
import { planMoveOperations } from './itemOperationPlanner'
import { trashTree, restoreTreeDescendants } from './treeOperations'
import { getSidebarItem } from './getSidebarItem'
import { collectDescendants } from './collectDescendants'
import type { SidebarItemLocation } from '../types/baseTypes'
import type { AnySidebarItem, AnySidebarItemRow } from '../types/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import { assertSidebarItemName } from '../validation/name'
import type { SidebarItemName } from '../validation/name'
import type { SidebarItemSlug } from '../validation/slug'
import type { ConflictDecisionAction, MoveOperation } from './itemOperationPlanner'

const clearDeletion = { deletionTime: null, deletedBy: null }

export const MOVE_OPERATION_ACTION = {
  move: 'move',
  skip: 'skip',
  replace: 'replace',
  mergeFolder: 'mergeFolder',
} as const

export type OperationDecision = {
  sourceItemId: Id<'sidebarItems'>
  action: ConflictDecisionAction
}

const MAX_SIDEBAR_MOVE_DEPTH = 50

function toDecisionRecord(decisions: Array<OperationDecision> | undefined) {
  return Object.fromEntries(
    (decisions ?? []).map((decision) => [decision.sourceItemId, { action: decision.action }]),
  ) as Partial<Record<Id<'sidebarItems'>, { action: ConflictDecisionAction }>>
}

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
  const itemFromDb = await getSidebarItem(ctx, itemId)
  const item = await requireItemAccess(ctx, {
    rawItem: itemFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  const isRelocating = location !== undefined && location !== item.location
  const isTrashing = isRelocating && location === SIDEBAR_ITEM_LOCATION.trash
  const isRestoring = isRelocating && item.location === SIDEBAR_ITEM_LOCATION.trash
  const isMoving = parentId !== undefined

  if (isRelocating && !isTrashing && !isRestoring) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'This move is not supported')
  }

  // --- Relocate: entering trash ---
  if (isTrashing) {
    if (
      item.type === SIDEBAR_ITEM_TYPES.folders &&
      ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM
    ) {
      throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can trash folders')
    }

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

  // --- Relocate: leaving trash ---
  if (isRestoring) {
    if (
      item.type === SIDEBAR_ITEM_TYPES.folders &&
      ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM
    ) {
      throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can restore folders')
    }
    if (location === undefined)
      throw new Error('Invariant: location must be defined when restoring')

    const restoreParentId = parentId ?? null
    const requestedName = name ? assertSidebarItemName(name) : null

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

    await ctx.db.patch('sidebarItems', itemId, {
      ...clearDeletion,
      ...conflictPatch,
      location: location,
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

  // --- Move (within same location) ---
  if (isMoving && !isRelocating) {
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

    await ctx.db.patch('sidebarItems', itemId, {
      parentId: parentId,
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

  return item._id
}

async function collectChildrenMap(
  ctx: CampaignMutationCtx,
  folderIds: Array<Id<'sidebarItems'>>,
): Promise<Map<Id<'sidebarItems'>, Array<AnySidebarItem>>> {
  const childrenMap = new Map<Id<'sidebarItems'>, Array<AnySidebarItem>>()
  const pending = folderIds.map((folderId) => ({ folderId, depth: 0 }))

  while (pending.length > 0) {
    const next = pending.shift()
    if (!next) break
    const { folderId, depth } = next
    if (childrenMap.has(folderId)) continue
    if (depth >= MAX_SIDEBAR_MOVE_DEPTH) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max sidebar move planning depth exceeded')
    }

    const children = await getSidebarItemsByParent(ctx, { parentId: folderId })
    childrenMap.set(folderId, children)
    for (const child of children) {
      if (child.type === SIDEBAR_ITEM_TYPES.folders) {
        pending.push({ folderId: child._id, depth: depth + 1 })
      }
    }
  }
  return childrenMap
}

async function executeMoveOperations(
  ctx: CampaignMutationCtx,
  operations: Array<MoveOperation>,
): Promise<Array<Id<'sidebarItems'>>> {
  const movedIds: Array<Id<'sidebarItems'>> = []

  for (const operation of operations) {
    if (operation.action === MOVE_OPERATION_ACTION.skip) continue

    const rawSource = await getSidebarItem(ctx, operation.sourceItemId)
    const source = await requireItemAccess(ctx, {
      rawItem: rawSource,
      requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
    })

    if (operation.action === MOVE_OPERATION_ACTION.mergeFolder) {
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
        await moveSidebarItem(ctx, {
          itemId: source._id,
          location: SIDEBAR_ITEM_LOCATION.trash,
        })
      }
      movedIds.push(destination._id)
      continue
    }

    if (operation.action === MOVE_OPERATION_ACTION.replace) {
      if (!operation.destinationItemId) {
        throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Replace requires a destination item')
      }
      const rawDestination = await getSidebarItem(ctx, operation.destinationItemId)
      const destination = await requireItemAccess(ctx, {
        rawItem: rawDestination,
        requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
      })
      if (destination.type === SIDEBAR_ITEM_TYPES.folders) {
        throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Folders are merged instead of replaced')
      }
      await moveSidebarItem(ctx, {
        itemId: destination._id,
        location: SIDEBAR_ITEM_LOCATION.trash,
      })
    }

    await moveSidebarItem(ctx, {
      itemId: source._id,
      parentId: operation.targetParentId,
      name: operation.name,
      location:
        source.location === SIDEBAR_ITEM_LOCATION.trash ? SIDEBAR_ITEM_LOCATION.sidebar : undefined,
    })
    movedIds.push(source._id)
  }

  return movedIds
}

export async function moveSidebarItems(
  ctx: CampaignMutationCtx,
  {
    sourceItemIds,
    targetParentId,
    decisions,
  }: {
    sourceItemIds: Array<Id<'sidebarItems'>>
    targetParentId: Id<'sidebarItems'> | null
    decisions?: Array<OperationDecision>
  },
): Promise<Array<Id<'sidebarItems'>>> {
  const sourceItems = await Promise.all(
    sourceItemIds.map(async (sourceItemId) => {
      const rawSource = await getSidebarItem(ctx, sourceItemId)
      return await requireItemAccess(ctx, {
        rawItem: rawSource,
        requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
      })
    }),
  )

  const targetItems = await getSidebarItemsByParent(ctx, { parentId: targetParentId })
  const folderIds = [...sourceItems, ...targetItems]
    .filter((item) => item.type === SIDEBAR_ITEM_TYPES.folders)
    .map((item) => item._id)
  const childrenMap = await collectChildrenMap(ctx, folderIds)
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
