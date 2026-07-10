import { ERROR_CODE } from '../../../../shared/errors/client'
import { throwClientError } from '../../../errors'
import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import { PERMISSION_OPERATION } from '../../../../shared/permissions/requirements'
import { logEditHistory } from '../../../editHistory/log'
import { assertConvexSidebarItemName } from '../../validation/name'
import { deduplicateResourceName } from '@wizard-archive/editor/resources/resource-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type {
  ResourceColor,
  ResourceName,
  ResourceIconName,
} from '@wizard-archive/editor/resources/resource-contract'

import { RESOURCE_EVENT_TYPE } from '@wizard-archive/editor/resources/transaction-contract'
import { evaluateCopy } from '@wizard-archive/editor/resources/operation-capabilities'
import { planTransferOperations } from '@wizard-archive/editor/resources/operation-contract'
import { normalizeSelectedRoots } from '@wizard-archive/editor/resources/selection-roots'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import type {
  ResourceCommand,
  ResourceEvent,
  ResourceOperationDecision,
} from '@wizard-archive/editor/resources/transaction-contract'
import type {
  OperationPlannerItem,
  TransferOperation,
} from '@wizard-archive/editor/resources/operation-contract'
import { collectSidebarChildrenMap } from '../children'
import { loadSidebarItemAncestorMap } from '../ancestors'
import { getActiveSidebarItemRowsByParent } from '../../functions/getSidebarItemsByParent'
import { isActiveSidebarItem } from '../../types/status'
import { assertSidebarOperationAllowed, operationActorFromRole } from '../capabilities'
import { checkSidebarItemRowAccess, requireSidebarItemRowOperationAccess } from '../access'
import type { AccessibleSidebarItemRow } from '../access'
import { copyCanvasCompanion } from '../../../canvases/functions/canvasCompanion'
import { copyFileCompanion } from '../../../files/functions/fileCompanion'
import { copyFolderCompanion } from '../../../folders/functions/folderCompanion'
import { copyMapCompanion } from '../../../gameMaps/functions/mapCompanion'
import { copyNoteCompanion } from '../../../notes/functions/noteCompanion'
import { createFileSystemWriteSession } from '../deltas'
import { createSidebarOperationReadModel, toSidebarOperationItems } from '../readModel'
import { getSidebarItemRow } from '../sidebarItemRows'
import type { CampaignMutationCtx } from '../../../functions'
import type { Id } from '../../../_generated/dataModel'
import type { FileSystemWriteSession, StoredResourceDelta } from '../deltas'
const MAX_COPY_DEPTH = 50
type CopyFileSystemCommand = Extract<ResourceCommand, { type: 'copy' }>
type CopyOrReplaceOperation = Extract<TransferOperation, { action: 'place' | 'replace' }>

type CopyCommandContext = {
  events: Array<ResourceEvent>
  session: FileSystemWriteSession
}

async function copySidebarItemContent(
  ctx: CampaignMutationCtx,
  source: AccessibleSidebarItemRow,
  targetItemId: Id<'sidebarItems'>,
) {
  switch (source.type) {
    case RESOURCE_TYPES.notes:
      await copyNoteCompanion(ctx, source._id, targetItemId)
      return
    case RESOURCE_TYPES.folders:
      await copyFolderCompanion(ctx, source._id, targetItemId)
      return
    case RESOURCE_TYPES.gameMaps:
      await copyMapCompanion(ctx, source._id, targetItemId)
      return
    case RESOURCE_TYPES.files:
      await copyFileCompanion(ctx, source._id, targetItemId)
      return
    case RESOURCE_TYPES.canvases:
      await copyCanvasCompanion(ctx, source._id, targetItemId)
      return
    default:
      source.type satisfies never
  }
}

async function getUniqueName(
  ctx: CampaignMutationCtx,
  parentId: Id<'sidebarItems'> | null,
  requestedName: string,
): Promise<ResourceName> {
  const siblings = await getActiveSidebarItemRowsByParent(ctx, { parentId })
  return assertConvexSidebarItemName(
    deduplicateResourceName(
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
    source: AccessibleSidebarItemRow
    parentId: Id<'sidebarItems'> | null
    name: ResourceName
    copyContext: CopyCommandContext
    isRoot?: boolean
  },
): Promise<Id<'sidebarItems'>> {
  const previewStorageId = source.previewStorageId
  const { itemId } = await copyContext.session.insertResource({
    type: source.type,
    name,
    parentId,
    iconName: (source.iconName as ResourceIconName | null) ?? undefined,
    color: (source.color as ResourceColor | null) ?? undefined,
    previewStorageId,
    previewUpdatedAt: previewStorageId ? (source.previewUpdatedAt ?? Date.now()) : undefined,
  })

  await copySidebarItemContent(ctx, source, itemId)

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
    copyContext.events.push({
      type: RESOURCE_EVENT_TYPE.copied,
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
    const source = await validateSidebarItemCopyable(ctx, child._id)
    const name = await getUniqueName(ctx, targetFolderId, source.name)
    const copiedChildId = await insertCopiedSidebarItem(ctx, {
      source,
      parentId: targetFolderId,
      name,
      copyContext,
    })
    if (source.type === RESOURCE_TYPES.folders) {
      await copyChildrenIntoFolder(
        ctx,
        {
          sourceFolderId: source._id,
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

async function executeCopyOperations(
  ctx: CampaignMutationCtx,
  operations: Array<TransferOperation>,
  rootSourceIds: ReadonlySet<Id<'sidebarItems'>>,
  session: FileSystemWriteSession,
): Promise<Array<ResourceEvent>> {
  const copyContext: CopyCommandContext = {
    events: [],
    session,
  }

  for (const operation of operations) {
    await executeCopyOperation(ctx, operation, copyContext, rootSourceIds)
  }

  return copyContext.events
}

async function executeCopyOperation(
  ctx: CampaignMutationCtx,
  operation: TransferOperation,
  copyContext: CopyCommandContext,
  rootSourceIds: ReadonlySet<Id<'sidebarItems'>>,
) {
  const source = await validateSidebarItemCopyable(ctx, operation.sourceItemId)

  if (operation.action === 'mergeFolder') {
    const destinationId = await logCopyFolderMerge(ctx, source, operation.destinationItemId)
    copyContext.events.push({
      type: RESOURCE_EVENT_TYPE.mergedFolder,
      itemId: destinationId,
      sourceItemId: source._id,
    })
    return
  }

  const parentId = operation.targetParentId ?? null
  let replacementDestinationId: Id<'sidebarItems'> | null = null
  if (operation.action === 'replace') {
    replacementDestinationId = operation.destinationItemId
    await trashCopyReplacement(ctx, operation.destinationItemId, copyContext.session)
  }

  const copiedId = await insertCopiedSidebarItem(ctx, {
    source,
    parentId,
    name: await resolveCopyName(ctx, operation, source, parentId),
    copyContext,
    isRoot: rootSourceIds.has(source._id),
  })
  if (replacementDestinationId) {
    copyContext.events.push({
      type: RESOURCE_EVENT_TYPE.replaced,
      itemId: replacementDestinationId,
      sourceItemId: source._id,
    })
  }

  if (source.type === RESOURCE_TYPES.folders) {
    await copyChildrenIntoFolder(ctx, {
      sourceFolderId: source._id,
      targetFolderId: copiedId,
      copyContext,
    })
  }
}

async function validateSidebarItemCopyable(
  ctx: CampaignMutationCtx,
  sourceItemId: Id<'sidebarItems'>,
) {
  const rawSource = await getSidebarItemRow(ctx, sourceItemId)
  if (!rawSource) throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  const source = await requireSidebarItemRowOperationAccess(ctx, {
    rawItem: rawSource,
    operation: PERMISSION_OPERATION.COPY_SIDEBAR_ITEM,
  })
  if (!isActiveSidebarItem(source)) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only active sidebar items can be copied')
  }
  return source
}

async function assertCopyableDescendants(
  ctx: CampaignMutationCtx,
  source: AccessibleSidebarItemRow,
  depth = 0,
) {
  if (source.type !== RESOURCE_TYPES.folders) return
  if (depth >= MAX_COPY_DEPTH) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max sidebar copy depth exceeded')
  }

  const children = await getActiveSidebarItemRowsByParent(ctx, { parentId: source._id })
  for (const child of children) {
    const copyableChild = await validateSidebarItemCopyable(ctx, child._id)
    await assertCopyableDescendants(ctx, copyableChild, depth + 1)
  }
}

async function logCopyFolderMerge(
  ctx: CampaignMutationCtx,
  source: AccessibleSidebarItemRow,
  destinationItemId: Id<'sidebarItems'> | undefined,
): Promise<Id<'sidebarItems'>> {
  if (source.type !== RESOURCE_TYPES.folders || !destinationItemId) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only folders can be merged')
  }

  const destination = await getSidebarItemRow(ctx, destinationItemId)
  if (!destination || destination.type !== RESOURCE_TYPES.folders) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Destination folder not found')
  }
  await requireSidebarItemRowOperationAccess(ctx, {
    rawItem: destination,
    operation: PERMISSION_OPERATION.MANAGE_SIDEBAR_ITEM,
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
  return destination._id
}

async function trashCopyReplacement(
  ctx: CampaignMutationCtx,
  destinationItemId: Id<'sidebarItems'>,
  session: FileSystemWriteSession,
) {
  const destination = await getSidebarItemRow(ctx, destinationItemId)
  if (!destination) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Destination item not found')
  }
  if (destination.type === RESOURCE_TYPES.folders) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Folders are merged instead of replaced')
  }
  const trashableDestination = await requireSidebarItemRowOperationAccess(ctx, {
    rawItem: destination,
    operation: PERMISSION_OPERATION.TRASH_SIDEBAR_ITEM,
  })
  await session.trashSidebarTree(trashableDestination)
}

async function resolveCopyName(
  ctx: CampaignMutationCtx,
  operation: CopyOrReplaceOperation,
  source: AccessibleSidebarItemRow,
  parentId: Id<'sidebarItems'> | null,
) {
  if (operation.name) return assertConvexSidebarItemName(operation.name)
  if (operation.action === 'replace') {
    return assertConvexSidebarItemName(source.name)
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
    await assertCopyableDescendants(ctx, source)
    assertSidebarOperationAllowed(
      evaluateCopy(operationActorFromRole(ctx.membership.role), source, {
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
  decisions?: Array<ResourceOperationDecision>
  childrenMap: ReadonlyMap<Id<'sidebarItems'>, Array<OperationPlannerItem>>
  itemsById: ReadonlyMap<Id<'sidebarItems'>, Pick<OperationPlannerItem, 'id' | 'parentId'>>
}) {
  const sourcePlannerItems = toSidebarOperationItems(sourceItems)
  return planTransferOperations({
    mode: 'copy',
    items: sourcePlannerItems,
    itemsById,
    targetParentId,
    targetItems,
    decisions,
    getChildren: (parentId) => childrenMap.get(parentId) ?? [],
  })
}

async function collectCopyPlanningChildrenMap(
  ctx: CampaignMutationCtx,
  sourceItems: Array<AccessibleSidebarItemRow>,
  targetItems: Array<{ _id: Id<'sidebarItems'>; type: string }>,
) {
  const folderIds = [...sourceItems, ...targetItems]
    .filter((item) => item.type === RESOURCE_TYPES.folders)
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
    decisions?: Array<ResourceOperationDecision>
    session: FileSystemWriteSession
  },
): Promise<Array<ResourceEvent>> {
  const targetItems = await getActiveSidebarItemRowsByParent(ctx, { parentId: targetParentId })
  const sourceItems = await loadCopyableSources(ctx, {
    sourceItemIds,
    targetParentId,
  })
  const childrenMap = await collectCopyPlanningChildrenMap(ctx, sourceItems, targetItems)
  const targetPlannerItems = toSidebarOperationItems(targetItems)
  const plannerChildrenMap = new Map(
    Array.from(childrenMap, ([parentId, children]) => [
      parentId,
      toSidebarOperationItems(children),
    ]),
  )
  const readModel = createSidebarOperationReadModel({
    items: [...sourceItems, ...targetItems],
    childrenMap,
  })
  const ancestorItemsById = await loadSidebarItemAncestorMap(ctx, {
    items: sourceItems,
    itemsById: readModel.itemsById,
    maxDepth: MAX_COPY_DEPTH,
  })
  const rootSourceIds = new Set(
    normalizeSelectedRoots(toSidebarOperationItems(sourceItems), ancestorItemsById).map(
      (item) => item.id,
    ),
  )
  const plan = planCopyEffects({
    sourceItems,
    targetParentId,
    targetItems: targetPlannerItems,
    decisions,
    childrenMap: plannerChildrenMap,
    itemsById: ancestorItemsById,
  })

  if (plan.status === 'needs-decision') {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Operation requires conflict decisions')
  }

  const events = await executeCopyOperations(ctx, plan.operations, rootSourceIds, session)
  for (const sourceItemId of plan.skippedSourceItemIds ?? []) {
    events.push({
      type: RESOURCE_EVENT_TYPE.skipped,
      itemId: sourceItemId,
      sourceItemId,
    })
  }
  return events
}

export async function executeCopyCommand(
  ctx: CampaignMutationCtx,
  {
    command,
    decisions,
  }: {
    command: CopyFileSystemCommand
    decisions?: Array<ResourceOperationDecision>
  },
): Promise<StoredResourceDelta> {
  const session = createFileSystemWriteSession(ctx)
  const events = await executeCopyPlan(ctx, {
    sourceItemIds: command.itemIds,
    targetParentId: command.targetParentId,
    decisions,
    session,
  })

  return await session.build({
    command,
    events,
  })
}
