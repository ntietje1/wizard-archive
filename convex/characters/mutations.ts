import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { insertTagAndNote } from '../tags/tags'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { Id } from '../_generated/dataModel'
import { createTagAndNoteArgs } from '../tags/schema'

export const createCharacter = mutation({
  args: {
    ...createTagAndNoteArgs,
    playerId: v.optional(v.id('campaignMembers')),
  },
  returns: v.object({
    tagId: v.id('tags'),
    noteId: v.id('notes'),
    characterId: v.id('characters'),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    tagId: Id<'tags'>
    noteId: Id<'notes'>
    characterId: Id<'characters'>
  }> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const { tagId, noteId } = await insertTagAndNote(ctx, args)

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

    return { tagId, noteId, characterId }
  },
})

export const updateCharacter = mutation({
  args: {
    characterId: v.id('characters'),
    playerId: v.optional(v.id('campaignMembers')),
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

    return args.characterId
  },
})
