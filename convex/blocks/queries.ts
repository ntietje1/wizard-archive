import { query } from '../_generated/server'
import { v } from 'convex/values'
import type { Block } from './types'
import { Id } from '../_generated/dataModel'
import {
  findBlock,
  filterOutChildBlocks,
  extractTagIdsFromBlockContent,
  getBlockLevelTags,
  getNoteLevelTag,
  doesBlockMatchRequiredTags,
} from '../tags/tags'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { hasAccessToBlock } from '../shares/shares'
import { blockValidator } from './schema'
import { getBlocksByCampaign } from './blocks'

//TODO: add to the index to allow for more efficient query here
export const getBlocksByTags = query({
  args: {
    campaignId: v.id('campaigns'),
    tagIds: v.array(v.id('tags')),
  },
  returns: v.array(blockValidator),
  handler: async (ctx, args): Promise<Block[]> => {
    const { campaignWithMembership } = await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )

    const allBlocks = await getBlocksByCampaign(ctx, args.campaignId)

    const checks = await Promise.all(
      allBlocks.map(async (block) => {
        try {
          const [hasSharedTag, matchesRequired] = await Promise.all([
            hasAccessToBlock(ctx, campaignWithMembership.member._id, block._id),
            doesBlockMatchRequiredTags(ctx, block._id, args.tagIds),
          ])
          return hasSharedTag && matchesRequired ? block : null
        } catch (error) {
          console.warn(
            `Error checking block access/tags for block ${block._id}:`,
            error,
          )
          return null
        }
      }),
    )
    const matchingBlocks: Block[] = checks.filter(Boolean) as Block[]

    const noteGroups = new Map<Id<'notes'>, Block[]>()
    matchingBlocks.forEach((block) => {
      if (!noteGroups.has(block.noteId)) {
        noteGroups.set(block.noteId, [])
      }
      noteGroups.get(block.noteId)!.push(block)
    })

    const filteredResults: Block[] = []
    const matchedNoteIds = Array.from(noteGroups.keys())
    const topByNote = new Map<Id<'notes'>, Block[]>()
    for (const b of allBlocks) {
      if (b.isTopLevel && matchedNoteIds.includes(b.noteId)) {
        const arr = topByNote.get(b.noteId) ?? []
        arr.push(b as Block)
        topByNote.set(b.noteId, arr)
      }
    }
    for (const [noteId, noteBlocks] of noteGroups) {
      const topLevelBlocks = (topByNote.get(noteId) ?? []).sort(
        (a, b) => (a.position || 0) - (b.position || 0),
      )

      const topLevelContent = topLevelBlocks.map((block) => block.content)

      const filtered = filterOutChildBlocks(noteBlocks, topLevelContent)
      filteredResults.push(...filtered)
    }

    return filteredResults
  },
})

export const getBlockTagState = query({
  args: {
    noteId: v.id('notes'),
    blockId: v.string(),
  },
  returns: v.union(
    v.object({
      allTagIds: v.array(v.id('tags')),
      inlineTagIds: v.array(v.id('tags')),
      blockTagIds: v.array(v.id('tags')),
      noteTagId: v.optional(v.id('tags')),
    }),
    v.null(),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<{
    allTagIds: Id<'tags'>[]
    inlineTagIds: Id<'tags'>[]
    blockTagIds: Id<'tags'>[]
    noteTagId: Id<'tags'> | undefined
  } | null> => {
    const note = await ctx.db.get(args.noteId)
    if (!note) throw new Error('Note not found')

    await requireCampaignMembership(
      ctx,
      { campaignId: note.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
    )
    const block = await findBlock(ctx, args.noteId, args.blockId)
    if (!block) {
      return null
    }
    const [blockTagIds, noteLevelTag] = await Promise.all([
      getBlockLevelTags(ctx, block._id),
      getNoteLevelTag(ctx, note._id),
    ])
    const inlineTagIds = extractTagIdsFromBlockContent(block.content)
    const noteTagId = noteLevelTag?._id

    const allTagIds = [
      ...new Set([
        ...blockTagIds,
        ...inlineTagIds,
        ...(noteTagId ? [noteTagId] : []),
      ]),
    ]

    return {
      allTagIds,
      inlineTagIds,
      blockTagIds,
      noteTagId,
    }
  },
})
