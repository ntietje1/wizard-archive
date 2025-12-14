import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import {
  insertTagAndNote,
  deleteTagAndCleanupContent,
  updateTagAndContent,
} from '../tags/tags'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { Id } from '../_generated/dataModel'
import { sidebarItemIdValidator } from '../sidebarItems/idValidator'

export const createCharacter = mutation({
  args: {
    name: v.optional(v.string()),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
    campaignId: v.id('campaigns'),
    categoryId: v.id('tagCategories'),
    parentId: v.optional(sidebarItemIdValidator),
    playerId: v.optional(v.id('campaignMembers')),
  },
  returns: v.object({
    tagId: v.id('tags'),
    characterId: v.id('characters'),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    tagId: Id<'tags'>
    characterId: Id<'characters'>
  }> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const { tagId } = await insertTagAndNote(
      ctx,
      args,
      args.parentId ?? args.categoryId,
    )

    if (args.playerId) {
      const player = await ctx.db.get(args.playerId)
      if (!player) {
        throw new Error('Player not found')
      }
      if (player.campaignId !== args.campaignId) {
        throw new Error('Player not found in campaign')
      }
    }

    const characterId = await ctx.db.insert('characters', {
      campaignId: args.campaignId,
      tagId,
      playerId: args.playerId,
    })

    return { tagId, characterId }
  },
})

export const updateCharacter = mutation({
  args: {
    characterId: v.id('characters'),
    playerId: v.optional(v.id('campaignMembers')),
    name: v.optional(v.string()),
    iconName: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.union(v.string(), v.null())),
    imageStorageId: v.optional(v.id('_storage')),
  },
  returns: v.id('characters'),
  handler: async (ctx, args): Promise<Id<'characters'>> => {
    const character = await ctx.db.get(args.characterId)
    if (!character) {
      throw new Error('Character not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: character.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    // Update tag fields if provided
    if (
      args.name !== undefined ||
      args.iconName !== undefined ||
      args.description !== undefined ||
      args.color !== undefined ||
      args.imageStorageId !== undefined
    ) {
      await updateTagAndContent(ctx, character.tagId, {
        name: args.name,
        iconName: args.iconName,
        description: args.description,
        color: args.color,
        imageStorageId: args.imageStorageId,
      })
    }

    // Update character-specific fields
    if (args.playerId) {
      const player = await ctx.db.get(args.playerId)
      if (!player || player.campaignId !== character.campaignId) {
        throw new Error(
          'Player must belong to the same campaign as the character',
        )
      }

      await ctx.db.patch(args.characterId, {
        playerId: args.playerId,
      })
    }

    return args.characterId
  },
})

export const deleteCharacter = mutation({
  args: {
    characterId: v.id('characters'),
  },
  returns: v.id('characters'),
  handler: async (ctx, args): Promise<Id<'characters'>> => {
    const character = await ctx.db.get(args.characterId)
    if (!character) {
      throw new Error('Character not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: character.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    await deleteTagAndCleanupContent(ctx, character.tagId)
    await ctx.db.delete(args.characterId)
    return args.characterId
  },
})
