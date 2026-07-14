import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { validateSidebarCreateParent } from '../validation/orchestration'
import { RESOURCE_PARENT_TARGET_KIND } from '@wizard-archive/editor/resources/resource-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { ResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { assertSidebarItemLifecycleConsistency, isActiveSidebarItem } from '../types/status'
import type { ParsedCreateParentTarget } from '../validation/parent'
import { initializeEmptySidebarItemCompanion } from './companionInitialization'
import { findActiveSidebarChildByName } from './siblings'
import { getSidebarItemRow } from './sidebarItemRows'
import { assertSidebarOperationAllowed, operationActorFromRole } from './capabilities'
import { evaluateCreateItem } from '@wizard-archive/editor/resources/operation-capabilities'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { FileSystemWriteSession } from './deltas'

async function getParentFolderId(
  ctx: CampaignMutationCtx,
  parentId: Id<'sidebarItems'>,
): Promise<Id<'sidebarItems'> | null> {
  const currentFolder = await getSidebarItemRow(ctx, parentId)
  if (currentFolder) assertSidebarItemLifecycleConsistency(currentFolder)
  if (!currentFolder || !isActiveSidebarItem(currentFolder)) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Parent not found')
  }

  return currentFolder.parentId
}

async function resolveOrCreateChildFolder(
  ctx: CampaignMutationCtx,
  session: FileSystemWriteSession,
  {
    parentId,
    segment,
  }: {
    parentId: Id<'sidebarItems'> | null
    segment: ResourceTitle
  },
): Promise<Id<'sidebarItems'>> {
  const existing = await findActiveSidebarChildByName(ctx, {
    parentId,
    name: segment,
  })

  if (!existing) {
    assertSidebarOperationAllowed(
      evaluateCreateItem(operationActorFromRole(ctx.membership.role), RESOURCE_TYPES.folders),
    )
    const { itemId } = await session.insertResource({
      type: RESOURCE_TYPES.folders,
      name: segment,
      parentId,
    })
    await initializeEmptySidebarItemCompanion(ctx, {
      itemId,
      itemType: RESOURCE_TYPES.folders,
    })
    return itemId
  }

  if (existing.type !== RESOURCE_TYPES.folders) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `"${segment}" already exists here and is not a folder`,
    )
  }

  await validateSidebarCreateParent(ctx, { parentId: existing._id })
  return existing._id
}

export async function resolveCreateCommandParentId(
  ctx: CampaignMutationCtx,
  session: FileSystemWriteSession,
  {
    parentTarget,
  }: {
    parentTarget: ParsedCreateParentTarget
  },
): Promise<Id<'sidebarItems'> | null> {
  if (parentTarget.kind === RESOURCE_PARENT_TARGET_KIND.direct) {
    return parentTarget.parentId
  }

  let currentParentId = parentTarget.baseParentId
  await validateSidebarCreateParent(ctx, { parentId: currentParentId })

  for (const segment of parentTarget.pathSegments) {
    if (segment === '.') {
      continue
    }

    if (segment === '..') {
      if (currentParentId === null) {
        throwClientError(
          ERROR_CODE.VALIDATION_FAILED,
          'Path cannot traverse above the campaign root',
        )
      }

      currentParentId = await getParentFolderId(ctx, currentParentId)
      await validateSidebarCreateParent(ctx, { parentId: currentParentId })
      continue
    }

    currentParentId = await resolveOrCreateChildFolder(ctx, session, {
      parentId: currentParentId,
      segment,
    })
  }

  return currentParentId
}
