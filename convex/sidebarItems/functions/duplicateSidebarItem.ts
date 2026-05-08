import { ERROR_CODE, throwClientError } from '../../errors'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { assertSidebarItemName } from '../validation/name'
import { deduplicateName } from './defaultItemName'
import { planDuplicateOperations } from '../operations/planner'
import { collectSidebarChildrenMap } from '../operations/childrenMap'
import { prepareSidebarItemCreate } from '../validation/orchestration'
import { getSidebarItem } from './getSidebarItem'
import { getSidebarItemsByParent } from './getSidebarItemsByParent'
import { moveSidebarItems } from './moveSidebarItem'
import { checkItemAccess, requireItemAccess } from '../validation/access'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { evaluateDuplicate } from '../operations/capabilities'
import { assertSidebarOperationAllowed } from './operationCapability'
import { toDecisionRecord } from './operationDecisions'
import type { OperationDecision } from './operationDecisions'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItem, AnySidebarItemRow } from '../types/types'
import type { DuplicateOperation } from '../operations/types'
import type { SidebarItemIconName } from '../validation/icon'
import type { SidebarItemName } from '../validation/name'

const MAX_SIDEBAR_DUPLICATE_DEPTH = 50

type DuplicateCopyOrReplaceOperation = Extract<DuplicateOperation, { action: 'copy' | 'replace' }>

export const DUPLICATE_OPERATION_ACTION = {
  copy: 'copy',
  skip: 'skip',
  replace: 'replace',
  mergeFolder: 'mergeFolder',
} as const

type DuplicateCtx = {
  createdItemIds: Array<Id<'sidebarItems'>>
}

function cloneStorageId(storageId: Id<'_storage'> | null): Id<'_storage'> | null {
  // Files and images intentionally share immutable Convex storage references.
  return storageId
}

async function getUniqueName(
  ctx: CampaignMutationCtx,
  parentId: Id<'sidebarItems'> | null,
  requestedName: string,
): Promise<SidebarItemName> {
  const siblings = await getSidebarItemsByParent(ctx, { parentId })
  return assertSidebarItemName(
    deduplicateName(
      requestedName,
      siblings.map((sibling) => sibling.name),
    ),
  )
}

async function copyYjsUpdates(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
  targetItemId: Id<'sidebarItems'>,
) {
  const updates = await ctx.db
    .query('yjsUpdates')
    .withIndex('by_document_seq', (q) => q.eq('documentId', sourceItemId))
    .order('asc')
    .collect()

  for (const update of updates) {
    await ctx.db.insert('yjsUpdates', {
      documentId: targetItemId,
      update: update.update,
      seq: update.seq,
      isSnapshot: update.isSnapshot,
    })
  }
}

async function copyNoteBlocks(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
  targetItemId: Id<'sidebarItems'>,
) {
  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('noteId', sourceItemId),
    )
    .collect()

  for (const block of blocks) {
    await ctx.db.insert('blocks', {
      noteId: targetItemId,
      blockNoteId: block.blockNoteId,
      position: block.position,
      parentBlockId: block.parentBlockId,
      depth: block.depth,
      type: block.type,
      props: block.props,
      inlineContent: block.inlineContent,
      plainText: block.plainText,
      campaignId: block.campaignId,
      shareStatus: block.shareStatus,
    })
  }
}

async function insertDuplicateSidebarItem(
  ctx: CampaignMutationCtx,
  {
    source,
    parentId,
    name,
    duplicateCtx,
  }: {
    source: AnySidebarItemRow
    parentId: Id<'sidebarItems'> | null
    name: SidebarItemName
    duplicateCtx: DuplicateCtx
  },
): Promise<Id<'sidebarItems'>> {
  const prepared = await prepareSidebarItemCreate(ctx, {
    parentId,
    name,
  })

  const itemId = await ctx.db.insert('sidebarItems', {
    name: prepared.name,
    slug: prepared.slug,
    campaignId: ctx.campaign._id,
    iconName: source.iconName as SidebarItemIconName | null,
    color: source.color,
    type: source.type,
    parentId,
    allPermissionLevel: null,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    previewStorageId: cloneStorageId(source.previewStorageId),
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: source.previewStorageId ? Date.now() : null,
    updatedTime: null,
    updatedBy: null,
    createdBy: ctx.membership.userId,
    deletionTime: null,
    deletedBy: null,
  })

  switch (source.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      await ctx.db.insert('notes', { sidebarItemId: itemId })
      await copyNoteBlocks(ctx, source._id, itemId)
      await copyYjsUpdates(ctx, source._id, itemId)
      break
    case SIDEBAR_ITEM_TYPES.folders: {
      const sourceFolder = await ctx.db
        .query('folders')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', source._id))
        .unique()
      await ctx.db.insert('folders', {
        sidebarItemId: itemId,
        inheritShares: sourceFolder?.inheritShares ?? false,
      })
      break
    }
    case SIDEBAR_ITEM_TYPES.gameMaps: {
      const sourceMap = await ctx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', source._id))
        .unique()
      await ctx.db.insert('gameMaps', {
        sidebarItemId: itemId,
        imageStorageId: cloneStorageId(sourceMap?.imageStorageId ?? null),
      })
      break
    }
    case SIDEBAR_ITEM_TYPES.files: {
      const sourceFile = await ctx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', source._id))
        .unique()
      await ctx.db.insert('files', {
        sidebarItemId: itemId,
        storageId: cloneStorageId(sourceFile?.storageId ?? null),
      })
      break
    }
    case SIDEBAR_ITEM_TYPES.canvases:
      await ctx.db.insert('canvases', { sidebarItemId: itemId })
      await copyYjsUpdates(ctx, source._id, itemId)
      break
    default:
      source satisfies never
  }

  await logEditHistory(ctx, {
    itemId,
    itemType: source.type,
    action: EDIT_HISTORY_ACTION.copied,
    metadata: {
      copiedFromItemId: source._id,
      copiedFromName: source.name,
    },
  })

  duplicateCtx.createdItemIds.push(itemId)
  return itemId
}

async function duplicateChildrenIntoFolder(
  ctx: CampaignMutationCtx,
  {
    sourceFolderId,
    targetFolderId,
    duplicateCtx,
  }: {
    sourceFolderId: Id<'sidebarItems'>
    targetFolderId: Id<'sidebarItems'>
    duplicateCtx: DuplicateCtx
  },
  depth = 0,
) {
  if (depth >= MAX_SIDEBAR_DUPLICATE_DEPTH) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max sidebar duplicate depth exceeded')
  }

  const children = await getSidebarItemsByParent(ctx, { parentId: sourceFolderId })
  for (const child of children) {
    const name = await getUniqueName(ctx, targetFolderId, child.name)
    const childDuplicateId = await insertDuplicateSidebarItem(ctx, {
      source: child,
      parentId: targetFolderId,
      name,
      duplicateCtx,
    })
    if (child.type === SIDEBAR_ITEM_TYPES.folders) {
      await duplicateChildrenIntoFolder(
        ctx,
        {
          sourceFolderId: child._id,
          targetFolderId: childDuplicateId,
          duplicateCtx,
        },
        depth + 1,
      )
    }
  }
}

async function collectDuplicateChildrenMap(
  ctx: CampaignMutationCtx,
  folderIds: Array<Id<'sidebarItems'>>,
) {
  return await collectSidebarChildrenMap({
    rootFolderIds: folderIds,
    maxDepth: MAX_SIDEBAR_DUPLICATE_DEPTH,
    getChildren: (parentId) => getSidebarItemsByParent(ctx, { parentId }),
    onDepthExceeded: () => {
      throwClientError(
        ERROR_CODE.VALIDATION_FAILED,
        'Max sidebar duplicate planning depth exceeded',
      )
    },
  })
}

async function executeDuplicateOperations(
  ctx: CampaignMutationCtx,
  operations: Array<DuplicateOperation>,
): Promise<Array<Id<'sidebarItems'>>> {
  const duplicateCtx: DuplicateCtx = {
    createdItemIds: [],
  }

  for (const operation of operations) {
    if (operation.action === DUPLICATE_OPERATION_ACTION.skip) continue
    await executeDuplicateOperation(ctx, operation, duplicateCtx)
  }

  return duplicateCtx.createdItemIds
}

async function executeDuplicateOperation(
  ctx: CampaignMutationCtx,
  operation: DuplicateOperation,
  duplicateCtx: DuplicateCtx,
) {
  if (operation.action === DUPLICATE_OPERATION_ACTION.skip) return

  const source = await loadDuplicableOperationSource(ctx, operation.sourceItemId)

  if (operation.action === DUPLICATE_OPERATION_ACTION.mergeFolder) {
    await logDuplicateFolderMerge(ctx, source, operation.destinationItemId)
    return
  }

  const parentId = operation.targetParentId ?? null
  if (operation.action === DUPLICATE_OPERATION_ACTION.replace) {
    await trashDuplicateReplacement(ctx, operation.destinationItemId)
  }

  const duplicateId = await insertDuplicateSidebarItem(ctx, {
    source,
    parentId,
    name: await resolveDuplicateName(ctx, operation, source, parentId),
    duplicateCtx,
  })

  if (source.type === SIDEBAR_ITEM_TYPES.folders) {
    await duplicateChildrenIntoFolder(ctx, {
      sourceFolderId: source._id,
      targetFolderId: duplicateId,
      duplicateCtx,
    })
  }
}

async function loadDuplicableOperationSource(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
) {
  return await validateSidebarItemDuplicable(ctx, sourceItemId)
}

async function validateSidebarItemDuplicable(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
) {
  const rawSource = await getSidebarItem(ctx, sourceItemId)
  if (!rawSource) throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  const source = await requireItemAccess(ctx, {
    rawItem: rawSource,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  if (source.location !== SIDEBAR_ITEM_LOCATION.sidebar) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only active sidebar items can be duplicated')
  }
  return source
}

async function logDuplicateFolderMerge(
  ctx: CampaignMutationCtx,
  source: AnySidebarItem,
  destinationItemId: Id<'sidebarItems'> | undefined,
) {
  if (source.type !== SIDEBAR_ITEM_TYPES.folders || !destinationItemId) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only folders can be merged')
  }

  const destination = await getSidebarItem(ctx, destinationItemId)
  if (!destination || destination.type !== SIDEBAR_ITEM_TYPES.folders) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Destination folder not found')
  }
  await requireItemAccess(ctx, {
    rawItem: destination,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  await logEditHistory(ctx, {
    itemId: destination._id,
    itemType: destination.type,
    action: EDIT_HISTORY_ACTION.copied,
    metadata: {
      copiedFromItemId: source._id,
      copiedFromName: source.name,
    },
  })
}

async function trashDuplicateReplacement(
  ctx: CampaignMutationCtx,
  destinationItemId: Id<'sidebarItems'> | undefined,
) {
  if (!destinationItemId) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Replace requires a destination item')
  }
  const destination = await getSidebarItem(ctx, destinationItemId)
  if (!destination) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Destination item not found')
  }
  if (destination.type === SIDEBAR_ITEM_TYPES.folders) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Folders are merged instead of replaced')
  }
  await moveSidebarItems(ctx, {
    sourceItemIds: [destination._id],
    targetParentId: null,
    action: 'trash',
  })
}

async function resolveDuplicateName(
  ctx: CampaignMutationCtx,
  operation: DuplicateCopyOrReplaceOperation,
  source: AnySidebarItem,
  parentId: Id<'sidebarItems'> | null,
) {
  if (operation.name) return assertSidebarItemName(operation.name)
  if (operation.action === DUPLICATE_OPERATION_ACTION.replace) {
    return assertSidebarItemName(source.name)
  }
  return await getUniqueName(ctx, parentId, source.name)
}

async function loadDuplicableSources(
  ctx: CampaignMutationCtx,
  {
    sourceItemIds,
    targetParentId,
  }: {
    sourceItemIds: Array<Id<'sidebarItems'>>
    targetParentId: Id<'sidebarItems'> | null
  },
) {
  const rawTargetParent = targetParentId === null ? null : await getSidebarItem(ctx, targetParentId)
  if (targetParentId !== null && !rawTargetParent) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Target parent not found')
  }
  const targetParent =
    rawTargetParent === null
      ? null
      : await checkItemAccess(ctx, {
          rawItem: rawTargetParent,
          requiredLevel: PERMISSION_LEVEL.NONE,
        })
  const sourceItems = []
  for (const sourceItemId of sourceItemIds) {
    const source = await validateSidebarItemDuplicable(ctx, sourceItemId)
    assertSidebarOperationAllowed(
      evaluateDuplicate({ role: ctx.membership.role }, source, {
        parentId: targetParentId,
        parent: targetParent,
      }),
    )
    sourceItems.push(source)
  }
  return sourceItems
}

async function planDuplicateSidebarItems(
  ctx: CampaignMutationCtx,
  {
    sourceItems,
    targetParentId,
    targetItems,
    decisions,
  }: {
    sourceItems: Array<AnySidebarItem>
    targetParentId: Id<'sidebarItems'> | null
    targetItems: Array<AnySidebarItem>
    decisions?: Array<OperationDecision>
  },
) {
  const folderIds = [...sourceItems, ...targetItems]
    .filter((item) => item.type === SIDEBAR_ITEM_TYPES.folders)
    .map((item) => item._id)
  const childrenMap = await collectDuplicateChildrenMap(ctx, folderIds)
  return planDuplicateOperations({
    items: sourceItems,
    targetParentId,
    targetItems,
    decisions: toDecisionRecord(decisions),
    getChildren: (parentId) => childrenMap.get(parentId) ?? [],
  })
}

export async function duplicateSidebarItems(
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
  const targetItems = await getSidebarItemsByParent(ctx, { parentId: targetParentId })
  const sourceItems = await loadDuplicableSources(ctx, {
    sourceItemIds,
    targetParentId,
  })
  const plan = await planDuplicateSidebarItems(ctx, {
    sourceItems,
    targetParentId,
    targetItems,
    decisions,
  })

  if (plan.status === 'cancelled') return []
  if (plan.status === 'needs-decision') {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Operation requires conflict decisions')
  }

  return await executeDuplicateOperations(ctx, plan.operations)
}
