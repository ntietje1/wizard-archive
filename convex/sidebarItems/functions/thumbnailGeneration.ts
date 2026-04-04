import { requireCampaignMembership } from '../../functions'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemId } from '../types/baseTypes'

const THUMBNAIL_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes
const THUMBNAIL_LOCK_TTL_MS = 30 * 1000 // 30 seconds

export async function claimThumbnailGeneration(
  ctx: AuthMutationCtx,
  { itemId }: { itemId: SidebarItemId },
): Promise<{ claimed: boolean; reason?: 'too_recent' | 'locked' }> {
  const item = await ctx.db.get(itemId)
  if (!item) return { claimed: false }

  await requireCampaignMembership(ctx, item.campaignId)

  const now = Date.now()

  // Only notes have debounce tracking — other types generate once on upload
  if (item.type === SIDEBAR_ITEM_TYPES.notes) {
    const noteId = itemId as Id<'notes'>
    const note = await ctx.db.get(noteId)
    if (!note) return { claimed: false }

    if (
      note.lastThumbnailUpdate &&
      now - note.lastThumbnailUpdate < THUMBNAIL_COOLDOWN_MS
    ) {
      return { claimed: false, reason: 'too_recent' }
    }

    if (
      note.thumbnailGenerationLock &&
      now - note.thumbnailGenerationLock < THUMBNAIL_LOCK_TTL_MS
    ) {
      return { claimed: false, reason: 'locked' }
    }

    await ctx.db.patch(noteId, { thumbnailGenerationLock: now })
  }

  return { claimed: true }
}

export async function commitThumbnail(
  ctx: AuthMutationCtx,
  {
    itemId,
    thumbnailStorageId,
  }: {
    itemId: SidebarItemId
    thumbnailStorageId: Id<'_storage'>
  },
): Promise<void> {
  const item = await ctx.db.get(itemId)
  if (!item) return

  await requireCampaignMembership(ctx, item.campaignId)

  // Delete old thumbnail if it exists and is different from the new one
  if (
    item.thumbnailStorageId &&
    item.thumbnailStorageId !== thumbnailStorageId
  ) {
    // Don't delete if it's the same as a primary storage ID (maps reuse imageStorageId)
    const isReusedId =
      item.type === SIDEBAR_ITEM_TYPES.gameMaps &&
      'imageStorageId' in item &&
      item.imageStorageId === item.thumbnailStorageId
    if (!isReusedId) {
      await ctx.storage.delete(item.thumbnailStorageId)
    }
  }

  // Patch based on item type to satisfy Convex's type system
  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      await ctx.db.patch(itemId as Id<'notes'>, {
        thumbnailStorageId,
        lastThumbnailUpdate: Date.now(),
        thumbnailGenerationLock: undefined,
      })
      break
    case SIDEBAR_ITEM_TYPES.folders:
      await ctx.db.patch(itemId as Id<'folders'>, { thumbnailStorageId })
      break
    case SIDEBAR_ITEM_TYPES.gameMaps:
      await ctx.db.patch(itemId as Id<'gameMaps'>, { thumbnailStorageId })
      break
    case SIDEBAR_ITEM_TYPES.files:
      await ctx.db.patch(itemId as Id<'files'>, { thumbnailStorageId })
      break
    case SIDEBAR_ITEM_TYPES.canvases:
      await ctx.db.patch(itemId as Id<'canvases'>, { thumbnailStorageId })
      break
  }
}
