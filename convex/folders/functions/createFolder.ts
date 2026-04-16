import {
  findUniqueSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import { validateItemName } from '../../sidebarItems/sharedValidation'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { ERROR_CODE, throwClientError } from '../../errors'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

async function findSidebarChildByName(
  ctx: CampaignMutationCtx,
  {
    parentId,
    name,
  }: {
    parentId: Id<'sidebarItems'> | null
    name: string
  },
): Promise<Doc<'sidebarItems'> | null> {
  const normalizedName = name.trim().toLowerCase()
  const siblings = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_location_parent_name', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('location', SIDEBAR_ITEM_LOCATION.sidebar)
        .eq('parentId', parentId),
    )
    .collect()

  return (
    siblings.find(
      (item) => item.deletionTime === null && item.name.trim().toLowerCase() === normalizedName,
    ) ?? null
  )
}

async function insertFolder(
  ctx: CampaignMutationCtx,
  {
    name,
    parentId,
    iconName,
    color,
  }: {
    name: string
    parentId: Id<'sidebarItems'> | null
    iconName?: string
    color?: string
  },
): Promise<{ folderId: Id<'sidebarItems'>; slug: string }> {
  await validateSidebarCreateParent(ctx, { parentId })
  await validateSidebarItemName(ctx, {
    parentId,
    name,
  })

  const uniqueSlug = await findUniqueSidebarItemSlug(ctx, {
    name,
  })

  const userId = ctx.membership.userId

  const folderId = await ctx.db.insert('sidebarItems', {
    name,
    slug: uniqueSlug,
    iconName: iconName ?? null,
    color: color ?? null,
    parentId,
    allPermissionLevel: null,
    campaignId: ctx.campaign._id,
    type: SIDEBAR_ITEM_TYPES.folders,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    previewStorageId: null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: userId,
  })

  await ctx.db.insert('folders', {
    sidebarItemId: folderId,
    inheritShares: false,
  })

  await logEditHistory(ctx, {
    itemId: folderId,
    itemType: SIDEBAR_ITEM_TYPES.folders,
    action: EDIT_HISTORY_ACTION.created,
  })

  return { folderId, slug: uniqueSlug }
}

export async function resolveOrCreateSidebarParentPath(
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
      continue
    }

    const { folderId } = await insertFolder(ctx, {
      name: trimmedSegment,
      parentId: resolvedParentId,
    })
    resolvedParentId = folderId
  }

  return resolvedParentId
}

export async function createFolder(
  ctx: CampaignMutationCtx,
  {
    name,
    parentId,
    parentPath,
    iconName,
    color,
  }: {
    name: string
    parentId: Id<'sidebarItems'> | null
    parentPath?: Array<string>
    iconName?: string
    color?: string
  },
): Promise<{ folderId: Id<'sidebarItems'>; slug: string }> {
  name = name.trim()
  parentId = await resolveOrCreateSidebarParentPath(ctx, { parentId, parentPath })

  return await insertFolder(ctx, {
    name,
    parentId,
    iconName,
    color,
  })
}
