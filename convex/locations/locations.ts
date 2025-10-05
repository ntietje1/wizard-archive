import { Location } from './types'
import { Id } from '../_generated/dataModel'
import { QueryCtx } from '../_generated/server'

export const combineLocationAndTag = (
  location: { _id: Id<'locations'> },
  tag: { _id: Id<'tags'> },
  category?: { _id: Id<'tagCategories'> },
): Location => {
  return {
    ...location,
    ...tag,
    category,
    tagId: tag._id,
    locationId: location._id,
  } as Location
}

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
  const category = await ctx.db.get(tag.categoryId)
  if (!category) {
    return null
  }
  return combineLocationAndTag(location, tag, category)
}
