import {
  MAX_RESOURCE_BOOKMARKS_PER_ACTOR,
  parseResourceBookmarkSelection,
} from '@wizard-archive/editor/resources/bookmarks'
import type { ResourceBookmarkMutationResult } from '@wizard-archive/editor/resources/bookmarks'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'

export async function loadActorBookmarks(ctx: CampaignMutationCtx | CampaignQueryCtx) {
  const rows = await ctx.db
    .query('resourceBookmarks')
    .withIndex('by_member', (index) =>
      index
        .eq('campaignUuid', ctx.resourceScope.campaignId)
        .eq('memberUuid', ctx.resourceScope.actorId),
    )
    .take(MAX_RESOURCE_BOOKMARKS_PER_ACTOR + 1)
  if (rows.length > MAX_RESOURCE_BOOKMARKS_PER_ACTOR) {
    throw new TypeError('Bookmark storage exceeds its bound')
  }
  return rows
}

export async function setActorBookmarkState(
  ctx: CampaignMutationCtx,
  inputResourceIds: ReadonlyArray<string>,
  bookmarked: boolean,
): Promise<ResourceBookmarkMutationResult> {
  const selection = parseResourceBookmarkSelection(inputResourceIds)
  if (selection.status === 'rejected') return selection
  const { resourceIds } = selection

  const resources = await Promise.all(
    resourceIds.map((resourceId) => findCanonicalResource(ctx.db, resourceId)),
  )
  if (
    resources.some(
      (resource) => !resource || resource.campaignUuid !== ctx.resourceScope.campaignId,
    )
  ) {
    return { status: 'rejected', reason: 'resource_missing' }
  }

  const existingBookmarks = await Promise.all(
    resourceIds.map((resourceId) =>
      ctx.db
        .query('resourceBookmarks')
        .withIndex('by_member_and_resource', (index) =>
          index
            .eq('campaignUuid', ctx.resourceScope.campaignId)
            .eq('memberUuid', ctx.resourceScope.actorId)
            .eq('resourceUuid', resourceId),
        )
        .unique(),
    ),
  )
  if (bookmarked) {
    const current = await loadActorBookmarks(ctx)
    const additions = existingBookmarks.filter((bookmark) => !bookmark).length
    if (current.length + additions > MAX_RESOURCE_BOOKMARKS_PER_ACTOR) {
      return { status: 'rejected', reason: 'selection_too_large' }
    }
  }

  const now = Date.now()
  await Promise.all(
    resourceIds.map(async (resourceId, index) => {
      const existing = existingBookmarks[index]
      if (bookmarked && !existing) {
        await ctx.db.insert('resourceBookmarks', {
          campaignUuid: ctx.resourceScope.campaignId,
          memberUuid: ctx.resourceScope.actorId,
          resourceUuid: resourceId,
          bookmarkedAt: now,
        })
      } else if (!bookmarked && existing) {
        await ctx.db.delete(existing._id)
      }
    }),
  )
  return { status: 'completed' }
}
