import { combineTagEntity, getTagCategory } from '../tags/tags'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import type { Character } from './types'

export const combineCharacterAndTag = (
  character: { _id: Id<'characters'> },
  tag: { _id: Id<'tags'> },
  category?: { _id: Id<'tagCategories'> },
): Character =>
  combineTagEntity<Character>('characterId', character, tag, category)

export const getCharacter = async (
  ctx: QueryCtx,
  characterId: Id<'characters'>,
): Promise<Character | null> => {
  const character = await ctx.db.get(characterId)
  if (!character) {
    return null
  }
  const tag = await ctx.db.get(character.tagId)
  if (!tag) {
    return null
  }
  const category = await getTagCategory(ctx, tag.campaignId, tag.categoryId)
  return combineCharacterAndTag(character, tag, category)
}
