import type { Id } from '../../_generated/dataModel'
import { throwClientError, ERROR_CODE } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import { validateItemName } from '../../sidebarItems/sharedValidation'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { validateSidebarCreateParent } from '../../sidebarItems/validation'
import { findSidebarChildByName, insertFolder } from './createFolder'

export async function resolveOrCreateFolderPath(
  ctx: CampaignMutationCtx,
  {
    parentId,
    parentPath,
  }: {
    parentId: Id<'sidebarItems'> | null
    parentPath?: Array<string>
  },
): Promise<Id<'sidebarItems'> | null> {
  let resolvedParentId = parentId

  for (const segment of parentPath ?? []) {
    await validateSidebarCreateParent(ctx, { parentId: resolvedParentId })

    const trimmedSegment = segment.trim()
    const nameResult = validateItemName(trimmedSegment)
    if (!nameResult.valid) {
      throwClientError(ERROR_CODE.VALIDATION_FAILED, nameResult.error)
    }

    const existing = await findSidebarChildByName(ctx, {
      parentId: resolvedParentId,
      name: trimmedSegment,
    })

    if (existing) {
      if (existing.type !== SIDEBAR_ITEM_TYPES.folders) {
        throwClientError(
          ERROR_CODE.VALIDATION_FAILED,
          `"${trimmedSegment}" already exists here and is not a folder`,
        )
      }
      resolvedParentId = existing._id
    } else {
      const { folderId } = await insertFolder(ctx, {
        name: trimmedSegment,
        parentId: resolvedParentId,
      })
      resolvedParentId = folderId
    }
  }

  return resolvedParentId
}
