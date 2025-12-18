import { Location } from './types'
import { Id } from '../_generated/dataModel'
import { QueryCtx } from '../_generated/server'
import { combineTagEntity, getTagCategory } from '../tags/tags'

export const combineLocationAndTag = (
  location: { _id: Id<'locations'> },
  tag: { _id: Id<'tags'> },
  category?: { _id: Id<'tagCategories'> },
): Location => combineTagEntity<Location>('locationId', location, tag, category)

export const getLocation = async (
  ctx: QueryCtx,
  locationId: Id<'locations'>,
): Promise<Location | null> => {
  const location = await ctx.db.get(locationId)
  if (!location) {
    return null
  }
  const tag = await ctx.db.get(location.tagId)
  if (!tag) {
    return null
  }
  const category = await getTagCategory(ctx, tag.campaignId, tag.categoryId)
  return combineLocationAndTag(location, tag, category)
}
