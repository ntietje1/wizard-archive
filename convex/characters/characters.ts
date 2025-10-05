import { Character } from './types'
import { Id } from '../_generated/dataModel'
import { QueryCtx } from '../_generated/server'
import { combineTagEntity } from '../tags/tags'

export const combineCharacterAndTag = (
  character: { _id: Id<'characters'> },
  tag: { _id: Id<'tags'> },
  category?: { _id: Id<'tagCategories'> },
): Character => combineTagEntity<Character>('characters', character, tag, category)

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
  const category = await ctx.db.get(tag.categoryId)
  if (!category) {
    return null
  }
  return combineCharacterAndTag(character, tag, category)
}
