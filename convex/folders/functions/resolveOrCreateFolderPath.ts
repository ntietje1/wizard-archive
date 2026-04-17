import type { Id } from '../../_generated/dataModel'
import { throwClientError, ERROR_CODE } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import { validateItemName } from '../../sidebarItems/sharedValidation'
import { CREATE_PARENT_TARGET_KIND } from '../../sidebarItems/createParentTarget'
import type { CreateParentTarget } from '../../sidebarItems/createParentTarget'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { validateSidebarCreateParent } from '../../sidebarItems/validation'
import { findSidebarChildByName, insertFolder } from './folderHelpers'

async function getParentFolderId(
  ctx: CampaignMutationCtx,
  parentId: Id<'sidebarItems'>,
): Promise<Id<'sidebarItems'> | null> {
  const currentFolder = await ctx.db.get('sidebarItems', parentId)
  if (!currentFolder || currentFolder.deletionTime !== null) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Parent not found')
  }

  return currentFolder.parentId
}

async function resolveOrCreateChildFolder(
  ctx: CampaignMutationCtx,
  {
    parentId,
    segment,
  }: {
    parentId: Id<'sidebarItems'> | null
    segment: string
  },
): Promise<Id<'sidebarItems'>> {
  const nameResult = validateItemName(segment)
  if (!nameResult.valid) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, nameResult.error)
  }

  const existing = await findSidebarChildByName(ctx, {
    parentId,
    name: segment,
  })

  if (!existing) {
    const { folderId } = await insertFolder(ctx, {
      name: segment,
      parentId,
    })
    return folderId
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

export async function resolveOrCreateFolderPath(
  ctx: CampaignMutationCtx,
  {
    parentTarget,
  }: {
    parentTarget: CreateParentTarget
  },
): Promise<Id<'sidebarItems'> | null> {
  if (parentTarget.kind === CREATE_PARENT_TARGET_KIND.direct) {
    return parentTarget.parentId
  }

  let currentParentId = parentTarget.baseParentId
  await validateSidebarCreateParent(ctx, { parentId: currentParentId })

  for (const segment of parentTarget.pathSegments) {
    const trimmedSegment = segment.trim()

    if (!trimmedSegment) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Path segments cannot be empty')
    }

    if (trimmedSegment === '.') {
      continue
    }

    if (trimmedSegment === '..') {
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

    currentParentId = await resolveOrCreateChildFolder(ctx, {
      parentId: currentParentId,
      segment: trimmedSegment,
    })
  }

  return currentParentId
}
