import { ERROR_CODE, throwClientError } from '../../errors'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { assertSidebarItemName } from '../validation/name'
import { deduplicateName } from './defaultItemName'
import { planDuplicateOperations } from '../operations/duplicatePlanner'
import { collectSidebarChildrenMap } from '../operations/childrenMap'
import { normalizeTopLevelSelectedItems } from '../operations/selection'
import { prepareSidebarItemCreate } from '../validation/orchestration'
import { getSidebarItem } from './getSidebarItem'
import { getSidebarItemsByParent } from './getSidebarItemsByParent'
import { checkItemAccess, requireItemAccess } from '../validation/access'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { evaluateDuplicate } from '../operations/capabilities'
import { assertSidebarOperationAllowed } from './operationCapability'
import { toDecisionRecord } from './operationDecisions'
import { trashSidebarItemTree } from './trashSidebarItemTree'
import { cloneStorageId, copyDuplicateSidebarItemContent } from './duplicateSidebarItemContent'
import type { OperationDecision } from './operationDecisions'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItem, AnySidebarItemRow } from '../types/types'
import type { DuplicateOperation } from '../operations/types'
import type { SidebarItemIconName } from '../validation/icon'
import type { SidebarItemName } from '../validation/name'

const MAX_SIDEBAR_DUPLICATE_DEPTH = 50
type DuplicateCopyOrReplaceOperation = Extract<DuplicateOperation, { action: 'copy' | 'replace' }>
type ExecutableDuplicateOperation = Exclude<DuplicateOperation, { action: 'skip' }>

export type DuplicateSidebarItemsResult = {
  createdItemIds: Array<Id<'sidebarItems'>>
  createdRootItemIds: Array<Id<'sidebarItems'>>
  copiedSourceItemIds: Array<Id<'sidebarItems'>>
  replacedSourceItemIds: Array<Id<'sidebarItems'>>
  mergedSourceItemIds: Array<Id<'sidebarItems'>>
  skippedSourceItemIds: Array<Id<'sidebarItems'>>
}

export const DUPLICATE_OPERATION_ACTION = {
  copy: 'copy',
  skip: 'skip',
  replace: 'replace',
  mergeFolder: 'mergeFolder',
} as const

type DuplicateCtx = {
  result: DuplicateSidebarItemsResult
}

function createEmptyDuplicateResult(): DuplicateSidebarItemsResult {
  return {
    createdItemIds: [],
    createdRootItemIds: [],
    copiedSourceItemIds: [],
    replacedSourceItemIds: [],
    mergedSourceItemIds: [],
    skippedSourceItemIds: [],
  }
}

function applySkippedDecisions(
  result: DuplicateSidebarItemsResult,
  decisions: Array<OperationDecision> | undefined,
) {
  const skipped = new Set(result.skippedSourceItemIds)
  for (const decision of decisions ?? []) {
    if (decision.action !== 'skip' || skipped.has(decision.sourceItemId)) continue
    result.skippedSourceItemIds.push(decision.sourceItemId)
    skipped.add(decision.sourceItemId)
  }
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

async function insertDuplicateSidebarItem(
  ctx: CampaignMutationCtx,
  {
    source,
    parentId,
    name,
    duplicateCtx,
    isRoot = false,
  }: {
    source: AnySidebarItemRow
    parentId: Id<'sidebarItems'> | null
    name: SidebarItemName
    duplicateCtx: DuplicateCtx
    isRoot?: boolean
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

  await copyDuplicateSidebarItemContent(ctx, source, itemId)

  await logEditHistory(ctx, {
    itemId,
    itemType: source.type,
    action: EDIT_HISTORY_ACTION.copied,
    metadata: {
      copiedFromItemId: source._id,
      copiedFromName: source.name,
    },
  })

  duplicateCtx.result.createdItemIds.push(itemId)
  if (isRoot) duplicateCtx.result.createdRootItemIds.push(itemId)
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

function normalizeDuplicateRootIds(
  sourceItems: Array<AnySidebarItem>,
  childrenMap: Awaited<ReturnType<typeof collectDuplicateChildrenMap>>,
): Set<Id<'sidebarItems'>> {
  const allItems = new Map<Id<'sidebarItems'>, Pick<AnySidebarItem, '_id' | 'parentId'>>()

  for (const sourceItem of sourceItems) {
    allItems.set(sourceItem._id, sourceItem)
  }
  for (const children of childrenMap.values()) {
    for (const child of children) {
      allItems.set(child._id, child)
    }
  }

  return new Set(normalizeTopLevelSelectedItems(sourceItems, allItems).map((item) => item._id))
}

async function executeDuplicateOperations(
  ctx: CampaignMutationCtx,
  operations: Array<DuplicateOperation>,
  rootSourceIds: ReadonlySet<Id<'sidebarItems'>>,
): Promise<DuplicateSidebarItemsResult> {
  const duplicateCtx: DuplicateCtx = {
    result: createEmptyDuplicateResult(),
  }

  for (const operation of operations) {
    if (operation.action === DUPLICATE_OPERATION_ACTION.skip) {
      duplicateCtx.result.skippedSourceItemIds.push(operation.sourceItemId)
      continue
    }
    await executeDuplicateOperation(ctx, operation, duplicateCtx, rootSourceIds)
  }

  return duplicateCtx.result
}

async function executeDuplicateOperation(
  ctx: CampaignMutationCtx,
  operation: ExecutableDuplicateOperation,
  duplicateCtx: DuplicateCtx,
  rootSourceIds: ReadonlySet<Id<'sidebarItems'>>,
) {
  const source = await loadDuplicableOperationSource(ctx, operation.sourceItemId)

  if (operation.action === DUPLICATE_OPERATION_ACTION.mergeFolder) {
    await logDuplicateFolderMerge(ctx, source, operation.destinationItemId)
    duplicateCtx.result.mergedSourceItemIds.push(source._id)
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
    isRoot: rootSourceIds.has(source._id),
  })
  if (operation.action === DUPLICATE_OPERATION_ACTION.replace) {
    duplicateCtx.result.replacedSourceItemIds.push(source._id)
  } else {
    duplicateCtx.result.copiedSourceItemIds.push(source._id)
  }

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
  const trashableDestination = await requireItemAccess(ctx, {
    rawItem: destination,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  await trashSidebarItemTree(ctx, trashableDestination)
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
  // checkItemAccess(rawTargetParent, NONE) verifies targetParent visibility/existence only;
  // source items require FULL_ACCESS because they are the items being copied.
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

function planDuplicateSidebarItems({
  sourceItems,
  targetParentId,
  targetItems,
  decisions,
  childrenMap,
}: {
  sourceItems: Array<AnySidebarItem>
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<AnySidebarItem>
  decisions?: Array<OperationDecision>
  childrenMap: Awaited<ReturnType<typeof collectDuplicateChildrenMap>>
}) {
  return planDuplicateOperations({
    items: sourceItems,
    targetParentId,
    targetItems,
    decisions: toDecisionRecord(decisions),
    getChildren: (parentId) => childrenMap.get(parentId) ?? [],
  })
}

async function collectDuplicatePlanningChildrenMap(
  ctx: CampaignMutationCtx,
  sourceItems: Array<AnySidebarItem>,
  targetItems: Array<AnySidebarItem>,
) {
  const folderIds = [...sourceItems, ...targetItems]
    .filter((item) => item.type === SIDEBAR_ITEM_TYPES.folders)
    .map((item) => item._id)
  return collectDuplicateChildrenMap(ctx, folderIds)
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
): Promise<DuplicateSidebarItemsResult> {
  const targetItems = await getSidebarItemsByParent(ctx, { parentId: targetParentId })
  const sourceItems = await loadDuplicableSources(ctx, {
    sourceItemIds,
    targetParentId,
  })
  const childrenMap = await collectDuplicatePlanningChildrenMap(ctx, sourceItems, targetItems)
  const rootSourceIds = normalizeDuplicateRootIds(sourceItems, childrenMap)
  const plan = planDuplicateSidebarItems({
    sourceItems,
    targetParentId,
    targetItems,
    decisions,
    childrenMap,
  })

  if (plan.status === 'cancelled') return createEmptyDuplicateResult()
  if (plan.status === 'needs-decision') {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Operation requires conflict decisions')
  }

  const result = await executeDuplicateOperations(ctx, plan.operations, rootSourceIds)
  applySkippedDecisions(result, decisions)
  return result
}
