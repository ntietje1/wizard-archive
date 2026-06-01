import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { validateSidebarCreateParent } from '../validation/orchestration'
import { CREATE_PARENT_TARGET_KIND } from '../../../shared/sidebar-items/parent-target'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { assertSidebarItemLifecycleConsistency, isActiveSidebarItem } from '../types/status'
import { initializeEmptySidebarItemCompanion } from './companionInitialization'
import { findActiveSidebarChildByName } from './siblings'
import { getSidebarItemRow } from './sidebarItemRows'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { ParsedCreateParentTarget } from '../../../shared/sidebar-items/parent-target'
import type { SidebarItemName } from '../../../shared/sidebar-items/name'
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
    segment: SidebarItemName
  },
): Promise<Id<'sidebarItems'>> {
  const existing = await findActiveSidebarChildByName(ctx, {
    parentId,
    name: segment,
  })

  if (!existing) {
    const { itemId } = await session.insertSidebarItem({
      type: SIDEBAR_ITEM_TYPES.folders,
      name: segment,
      parentId,
    })
    await initializeEmptySidebarItemCompanion(ctx, {
      itemId,
      itemType: SIDEBAR_ITEM_TYPES.folders,
    })
    return itemId
  }

  if (existing.type !== SIDEBAR_ITEM_TYPES.folders) {
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
  if (parentTarget.kind === CREATE_PARENT_TARGET_KIND.direct) {
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
