import { ERROR_CODE, throwClientError } from '../../../errors'
import { EDIT_HISTORY_ACTION } from '../../../editHistory/types'
import { PERMISSION_LEVEL } from '../../../permissions/types'
import { logEditHistory } from '../../../editHistory/log'
import { assertSidebarItemName } from '../../validation/name'
import { deduplicateName } from '../../functions/defaultItemName'
import { planTransferOperations } from '../transferPlanner'
import { collectSidebarChildrenMap } from '../children'
import { normalizeSelectedRoots } from '../selection'
import { addSidebarItemAncestorsToMap } from '../ancestors'
import type { OperationPlannerItem } from '../selection'
import { getActiveSidebarItemRowsByParent } from '../../functions/getSidebarItemsByParent'
import { SIDEBAR_ITEM_TYPES } from '../../types/baseTypes'
import { isActiveSidebarItem } from '../../types/status'
import { assertSidebarOperationAllowed, evaluateCopy } from '../capabilities'
import { checkSidebarItemRowAccess, requireSidebarItemRowAccess } from '../access'
import type { AccessibleSidebarItemRow } from '../access'
import { toDecisionRecord } from '../conflicts'
import {
  cloneStorageId,
  copyDuplicateSidebarItemContent,
} from '../../functions/duplicateSidebarItemContent'
import { createFileSystemWriteSession } from '../deltas'
import { FILE_SYSTEM_EVENT_TYPE } from '../receipts'
import { createFileSystemReadModel } from '../readModel'
import { getSidebarItemRow } from '../sidebarItemRows'
import type { OperationDecision } from '../conflicts'
import type { CampaignMutationCtx } from '../../../functions'
import type { Id } from '../../../_generated/dataModel'
import type { CopyFileSystemCommand, FileSystemOperationDecision } from '../commands'
import type { AnySidebarItemRow } from '../../types/types'
import type { TransferOperation } from '../operationTypes'
import type { SidebarItemColor } from '../../validation/color'
import type { SidebarItemIconName } from '../../validation/icon'
import type { SidebarItemName } from '../../validation/name'
import type { FileSystemWriteSession } from '../deltas'
import type { FileSystemDelta, FileSystemEvent } from '../receipts'

const MAX_COPY_DEPTH = 50
type CopyOrReplaceOperation = Extract<TransferOperation, { action: 'place' | 'replace' }>
type ExecutableCopyOperation = TransferOperation

type CopyCommandResult = {
  events: Array<FileSystemEvent>
}

const COPY_OPERATION_ACTION = {
  place: 'place',
  replace: 'replace',
  mergeFolder: 'mergeFolder',
} as const

type CopyCommandContext = {
  result: CopyCommandResult
  session: FileSystemWriteSession
}

function createEmptyCopyCommandResult(): CopyCommandResult {
  return {
    events: [],
  }
}

function applySkippedDecisions(
  result: CopyCommandResult,
  decisions: Array<OperationDecision> | undefined,
) {
  const skipped = new Set(
    result.events
      .filter((event) => event.type === FILE_SYSTEM_EVENT_TYPE.skipped)
      .map((event) => event.itemId),
  )
  for (const decision of decisions ?? []) {
    if (decision.action !== 'skip' || skipped.has(decision.sourceItemId)) continue
    result.events.push({
      type: FILE_SYSTEM_EVENT_TYPE.skipped,
      itemId: decision.sourceItemId,
      sourceItemId: decision.sourceItemId,
    })
    skipped.add(decision.sourceItemId)
  }
}

async function getUniqueName(
  ctx: CampaignMutationCtx,
  parentId: Id<'sidebarItems'> | null,
  requestedName: string,
): Promise<SidebarItemName> {
  const siblings = await getActiveSidebarItemRowsByParent(ctx, { parentId })
  return assertSidebarItemName(
    deduplicateName(
      requestedName,
      siblings.map((sibling) => sibling.name),
    ),
  )
}

async function insertCopiedSidebarItem(
  ctx: CampaignMutationCtx,
  {
    source,
    parentId,
    name,
    copyContext,
    isRoot = false,
  }: {
    source: AnySidebarItemRow
    parentId: Id<'sidebarItems'> | null
    name: SidebarItemName
    copyContext: CopyCommandContext
    isRoot?: boolean
  },
): Promise<Id<'sidebarItems'>> {
  const previewStorageId = cloneStorageId(source.previewStorageId)
  const { itemId } = await copyContext.session.insertSidebarItem({
    type: source.type,
    name,
    parentId,
    iconName: (source.iconName as SidebarItemIconName | null) ?? undefined,
    color: (source.color as SidebarItemColor | null) ?? undefined,
    previewStorageId,
    previewUpdatedAt: previewStorageId ? (source.previewUpdatedAt ?? Date.now()) : undefined,
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

  if (isRoot) {
    copyContext.result.events.push({
      type: FILE_SYSTEM_EVENT_TYPE.copied,
      itemId,
      sourceItemId: source._id,
    })
  }
  return itemId
}

async function copyChildrenIntoFolder(
  ctx: CampaignMutationCtx,
  {
    sourceFolderId,
    targetFolderId,
    copyContext,
  }: {
    sourceFolderId: Id<'sidebarItems'>
    targetFolderId: Id<'sidebarItems'>
    copyContext: CopyCommandContext
  },
  depth = 0,
) {
  if (depth >= MAX_COPY_DEPTH) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max sidebar copy depth exceeded')
  }

  const children = await getActiveSidebarItemRowsByParent(ctx, { parentId: sourceFolderId })
  for (const child of children) {
    const name = await getUniqueName(ctx, targetFolderId, child.name)
    const copiedChildId = await insertCopiedSidebarItem(ctx, {
      source: child,
      parentId: targetFolderId,
      name,
      copyContext,
    })
    if (child.type === SIDEBAR_ITEM_TYPES.folders) {
      await copyChildrenIntoFolder(
        ctx,
        {
          sourceFolderId: child._id,
          targetFolderId: copiedChildId,
          copyContext,
        },
        depth + 1,
      )
    }
  }
}

async function collectCopyChildrenMap(
  ctx: CampaignMutationCtx,
  folderIds: Array<Id<'sidebarItems'>>,
) {
  return await collectSidebarChildrenMap({
    rootFolderIds: folderIds,
    maxDepth: MAX_COPY_DEPTH,
    getChildren: (parentId) => getActiveSidebarItemRowsByParent(ctx, { parentId }),
    onDepthExceeded: () => {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max sidebar copy planning depth exceeded')
    },
  })
}

function buildCopyReadModel(
  items: Array<AccessibleSidebarItemRow | OperationPlannerItem>,
  childrenMap: ReadonlyMap<Id<'sidebarItems'>, Array<OperationPlannerItem>>,
) {
  const rowsById = new Map<
    Id<'sidebarItems'>,
    Pick<OperationPlannerItem, '_id' | 'parentId' | 'status'>
  >()
  for (const item of items) {
    rowsById.set(item._id, { _id: item._id, parentId: item.parentId, status: item.status })
  }
  for (const children of childrenMap.values()) {
    for (const child of children) {
      rowsById.set(child._id, { _id: child._id, parentId: child.parentId, status: child.status })
    }
  }
  return createFileSystemReadModel(Array.from(rowsById.values()))
}

async function executeCopyOperations(
  ctx: CampaignMutationCtx,
  operations: Array<TransferOperation>,
  rootSourceIds: ReadonlySet<Id<'sidebarItems'>>,
  session: FileSystemWriteSession,
): Promise<CopyCommandResult> {
  const copyContext: CopyCommandContext = {
    result: createEmptyCopyCommandResult(),
    session,
  }

  for (const operation of operations) {
    await executeCopyOperation(ctx, operation, copyContext, rootSourceIds)
  }

  return copyContext.result
}

async function executeCopyOperation(
  ctx: CampaignMutationCtx,
  operation: ExecutableCopyOperation,
  copyContext: CopyCommandContext,
  rootSourceIds: ReadonlySet<Id<'sidebarItems'>>,
) {
  const source = await loadCopyableOperationSource(ctx, operation.sourceItemId)

  if (operation.action === COPY_OPERATION_ACTION.mergeFolder) {
    await logCopyFolderMerge(ctx, source, operation.destinationItemId)
    copyContext.result.events.push({
      type: FILE_SYSTEM_EVENT_TYPE.mergedFolder,
      itemId: source._id,
      sourceItemId: source._id,
    })
    return
  }

  const parentId = operation.targetParentId ?? null
  if (operation.action === COPY_OPERATION_ACTION.replace) {
    await trashCopyReplacement(ctx, operation.destinationItemId, copyContext.session)
  }

  const copiedId = await insertCopiedSidebarItem(ctx, {
    source,
    parentId,
    name: await resolveCopyName(ctx, operation, source, parentId),
    copyContext,
    isRoot: rootSourceIds.has(source._id),
  })
  if (operation.action === COPY_OPERATION_ACTION.replace) {
    copyContext.result.events.push({
      type: FILE_SYSTEM_EVENT_TYPE.replaced,
      itemId: source._id,
      sourceItemId: source._id,
    })
  }

  if (source.type === SIDEBAR_ITEM_TYPES.folders) {
    await copyChildrenIntoFolder(ctx, {
      sourceFolderId: source._id,
      targetFolderId: copiedId,
      copyContext,
    })
  }
}

async function loadCopyableOperationSource(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
) {
  return await validateSidebarItemCopyable(ctx, sourceItemId)
}

async function validateSidebarItemCopyable(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
) {
  const rawSource = await getSidebarItemRow(ctx, sourceItemId)
  if (!rawSource) throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  const source = await requireSidebarItemRowAccess(ctx, {
    rawItem: rawSource,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  if (!isActiveSidebarItem(source)) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only active sidebar items can be copied')
  }
  return source
}

async function logCopyFolderMerge(
  ctx: CampaignMutationCtx,
  source: AccessibleSidebarItemRow,
  destinationItemId: Id<'sidebarItems'> | undefined,
) {
  if (source.type !== SIDEBAR_ITEM_TYPES.folders || !destinationItemId) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only folders can be merged')
  }

  const destination = await getSidebarItemRow(ctx, destinationItemId)
  if (!destination || destination.type !== SIDEBAR_ITEM_TYPES.folders) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Destination folder not found')
  }
  await requireSidebarItemRowAccess(ctx, {
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

async function trashCopyReplacement(
  ctx: CampaignMutationCtx,
  destinationItemId: Id<'sidebarItems'> | undefined,
  session: FileSystemWriteSession,
) {
  if (!destinationItemId) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Replace requires a destination item')
  }
  const destination = await getSidebarItemRow(ctx, destinationItemId)
  if (!destination) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Destination item not found')
  }
  if (destination.type === SIDEBAR_ITEM_TYPES.folders) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Folders are merged instead of replaced')
  }
  const trashableDestination = await requireSidebarItemRowAccess(ctx, {
    rawItem: destination,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  await session.trashSidebarTree(trashableDestination)
}

async function resolveCopyName(
  ctx: CampaignMutationCtx,
  operation: CopyOrReplaceOperation,
  source: AccessibleSidebarItemRow,
  parentId: Id<'sidebarItems'> | null,
) {
  if (operation.name) return assertSidebarItemName(operation.name)
  if (operation.action === COPY_OPERATION_ACTION.replace) {
    return assertSidebarItemName(source.name)
  }
  return await getUniqueName(ctx, parentId, source.name)
}

async function loadCopyableSources(
  ctx: CampaignMutationCtx,
  {
    sourceItemIds,
    targetParentId,
  }: {
    sourceItemIds: Array<Id<'sidebarItems'>>
    targetParentId: Id<'sidebarItems'> | null
  },
) {
  const rawTargetParent =
    targetParentId === null ? null : await getSidebarItemRow(ctx, targetParentId)
  if (targetParentId !== null && !rawTargetParent) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Target parent not found')
  }
  // checkItemAccess(rawTargetParent, NONE) verifies targetParent visibility/existence only;
  // source items require FULL_ACCESS because they are the items being copied.
  const targetParent =
    rawTargetParent === null
      ? null
      : await checkSidebarItemRowAccess(ctx, {
          rawItem: rawTargetParent,
          requiredLevel: PERMISSION_LEVEL.NONE,
        })
  const targetAncestorIds: Array<Id<'sidebarItems'>> = []
  let currentParentId = rawTargetParent?.parentId ?? null
  if (rawTargetParent) targetAncestorIds.push(rawTargetParent._id)
  while (currentParentId) {
    if (targetAncestorIds.length >= MAX_COPY_DEPTH) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max sidebar copy target depth exceeded')
    }
    const currentParent = await getSidebarItemRow(ctx, currentParentId)
    if (!currentParent) break
    targetAncestorIds.push(currentParent._id)
    currentParentId = currentParent.parentId
  }
  const sourceItems = []
  for (const sourceItemId of sourceItemIds) {
    const source = await validateSidebarItemCopyable(ctx, sourceItemId)
    assertSidebarOperationAllowed(
      evaluateCopy({ role: ctx.membership.role }, source, {
        parentId: targetParentId,
        parent: targetParent,
        ancestorIds: targetAncestorIds,
      }),
    )
    sourceItems.push(source)
  }
  return sourceItems
}

function planCopyEffects({
  sourceItems,
  targetParentId,
  targetItems,
  decisions,
  childrenMap,
  itemsById,
}: {
  sourceItems: Array<AccessibleSidebarItemRow>
  targetParentId: Id<'sidebarItems'> | null
  targetItems: Array<OperationPlannerItem>
  decisions?: Array<OperationDecision>
  childrenMap: ReadonlyMap<Id<'sidebarItems'>, Array<OperationPlannerItem>>
  itemsById: ReadonlyMap<
    Id<'sidebarItems'>,
    Pick<AccessibleSidebarItemRow, '_id' | 'parentId' | 'status'>
  >
}) {
  return planTransferOperations({
    mode: 'copy',
    items: sourceItems,
    itemsById,
    targetParentId,
    targetItems,
    decisions: toDecisionRecord(decisions),
    getChildren: (parentId) => childrenMap.get(parentId) ?? [],
  })
}

async function collectCopyPlanningChildrenMap(
  ctx: CampaignMutationCtx,
  sourceItems: Array<AccessibleSidebarItemRow>,
  targetItems: Array<OperationPlannerItem>,
) {
  const folderIds = [...sourceItems, ...targetItems]
    .filter((item) => item.type === SIDEBAR_ITEM_TYPES.folders)
    .map((item) => item._id)
  return collectCopyChildrenMap(ctx, folderIds)
}

async function executeCopyPlan(
  ctx: CampaignMutationCtx,
  {
    sourceItemIds,
    targetParentId,
    decisions,
    session,
  }: {
    sourceItemIds: Array<Id<'sidebarItems'>>
    targetParentId: Id<'sidebarItems'> | null
    decisions?: Array<OperationDecision>
    session: FileSystemWriteSession
  },
): Promise<CopyCommandResult> {
  const targetItems = await getActiveSidebarItemRowsByParent(ctx, { parentId: targetParentId })
  const sourceItems = await loadCopyableSources(ctx, {
    sourceItemIds,
    targetParentId,
  })
  const childrenMap = await collectCopyPlanningChildrenMap(ctx, sourceItems, targetItems)
  const readModel = buildCopyReadModel([...sourceItems, ...targetItems], childrenMap)
  await addSidebarItemAncestorsToMap(ctx, {
    items: sourceItems,
    itemsById: readModel.itemsById,
    maxDepth: MAX_COPY_DEPTH,
  })
  const rootSourceIds = new Set(
    normalizeSelectedRoots(sourceItems, readModel.itemsById).map((item) => item._id),
  )
  const plan = planCopyEffects({
    sourceItems,
    targetParentId,
    targetItems,
    decisions,
    childrenMap,
    itemsById: readModel.itemsById,
  })

  if (plan.status === 'needs-decision') {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Operation requires conflict decisions')
  }

  const result = await executeCopyOperations(ctx, plan.operations, rootSourceIds, session)
  applySkippedDecisions(result, decisions)
  return result
}

export async function executeCopyCommand(
  ctx: CampaignMutationCtx,
  {
    command,
    decisions,
  }: {
    command: CopyFileSystemCommand
    decisions?: Array<FileSystemOperationDecision>
  },
): Promise<FileSystemDelta> {
  const session = createFileSystemWriteSession(ctx)
  const result = await executeCopyPlan(ctx, {
    sourceItemIds: command.itemIds,
    targetParentId: command.targetParentId,
    decisions,
    session,
  })

  return await session.build({
    command,
    events: result.events,
  })
}
