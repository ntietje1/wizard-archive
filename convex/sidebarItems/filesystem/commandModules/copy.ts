import { ERROR_CODE } from '../../../../shared/errors/client'
import { throwClientError } from '../../../errors'
import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import { PERMISSION_OPERATION } from '../../../../shared/permissions/requirements'
import { logEditHistory } from '../../../editHistory/log'
import { assertConvexResourceTitle } from '../../validation/name'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type {
  ResourceColor,
  ResourceIconName,
} from '@wizard-archive/editor/resources/resource-contract'
import type { ResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'

import { RESOURCE_EVENT_TYPE } from '@wizard-archive/editor/resources/transaction-contract'
import { evaluateCopy } from '@wizard-archive/editor/resources/operation-capabilities'
import { planTransferOperations } from '@wizard-archive/editor/resources/operation-contract'
import { normalizeSelectedRoots } from '@wizard-archive/editor/resources/selection-roots'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import type {
  ResourceCommand,
  ResourceEvent,
} from '@wizard-archive/editor/resources/transaction-contract'
import type { TransferOperation } from '@wizard-archive/editor/resources/operation-contract'
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
import {
  requireSidebarItemRow,
  requireSidebarItemRows,
  sidebarItemResourceId,
} from '../../functions/sidebarItemIdentity'
const MAX_COPY_DEPTH = 50
type CopyFileSystemCommand = Extract<ResourceCommand, { type: 'copy' }>

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
    name: ResourceTitle
    copyContext: CopyCommandContext
    isRoot?: boolean
  },
): Promise<Id<'sidebarItems'>> {
  const previewStorageId = source.previewStorageId
  const { itemId, resourceId } = await copyContext.session.insertResource({
    resourceId: generateDomainId(DOMAIN_ID_KIND.resource),
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
      copiedFromItemId: sidebarItemResourceId(source),
      copiedFromName: source.name,
    },
  })

  if (isRoot) {
    copyContext.events.push({
      type: RESOURCE_EVENT_TYPE.copied,
      itemId: resourceId,
      sourceItemId: sidebarItemResourceId(source),
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
    const name = assertConvexResourceTitle(source.name)
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

async function executeCopyOperations(
  ctx: CampaignMutationCtx,
  operations: Array<TransferOperation<Id<'sidebarItems'>>>,
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
  operation: TransferOperation<Id<'sidebarItems'>>,
  copyContext: CopyCommandContext,
  rootSourceIds: ReadonlySet<Id<'sidebarItems'>>,
) {
  const source = await validateSidebarItemCopyable(ctx, operation.sourceItemId)

  const parentId = operation.targetParentId ?? null
  const copiedId = await insertCopiedSidebarItem(ctx, {
    source,
    parentId,
    name: assertConvexResourceTitle(operation.name ?? source.name),
    copyContext,
    isRoot: rootSourceIds.has(source._id),
  })
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
  itemsById,
}: {
  sourceItems: Array<AccessibleSidebarItemRow>
  targetParentId: Id<'sidebarItems'> | null
  itemsById: ReadonlyMap<
    Id<'sidebarItems'>,
    { id: Id<'sidebarItems'>; parentId: Id<'sidebarItems'> | null }
  >
}) {
  return planTransferOperations({
    mode: 'copy',
    items: toSidebarOperationItems(sourceItems),
    itemsById,
    targetParentId,
  })
}

async function executeCopyPlan(
  ctx: CampaignMutationCtx,
  {
    sourceItemIds,
    targetParentId,
    session,
  }: {
    sourceItemIds: Array<Id<'sidebarItems'>>
    targetParentId: Id<'sidebarItems'> | null
    session: FileSystemWriteSession
  },
): Promise<Array<ResourceEvent>> {
  const sourceItems = await loadCopyableSources(ctx, {
    sourceItemIds,
    targetParentId,
  })
  const readModel = createSidebarOperationReadModel({
    items: sourceItems,
    childrenMap: new Map(),
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
    itemsById: ancestorItemsById,
  })

  const events = await executeCopyOperations(ctx, plan, rootSourceIds, session)
  return events
}

export async function executeCopyCommand(
  ctx: CampaignMutationCtx,
  {
    command,
  }: {
    command: CopyFileSystemCommand
  },
): Promise<StoredResourceDelta> {
  const session = createFileSystemWriteSession(ctx)
  const sourceRows = await requireSidebarItemRows(ctx, command.itemIds)
  const targetParentRow =
    command.targetParentId === null
      ? null
      : await requireSidebarItemRow(ctx, command.targetParentId)
  const events = await executeCopyPlan(ctx, {
    sourceItemIds: sourceRows.map((row) => row._id),
    targetParentId: targetParentRow?._id ?? null,
    session,
  })

  return await session.build({
    command,
    events,
  })
}
