import { v } from 'convex/values'
import { campaignQuery, dmQuery } from '../functions'
import { blockVisibilityPermissionLevelValidator } from '../blockShares/schema'
import { campaignMemberIdValidator, campaignMemberSummaryValidator } from '../campaigns/schema'
import { permissionLevelValidator } from '../sidebarItems/schema/validators'
import { blockNoteIdValidator, blockShareStatusValidator, blockTypeValidator } from './schema'
import { getBlocksWithShares as getBlocksWithSharesFn } from './functions/getBlocksWithShares'
import { getHeadingsByNote as getHeadingsByNoteFn } from './functions/getHeadingsByNote'
import {
  searchBlocks as searchBlocksFn,
  searchBlocksAsMember as searchBlocksAsMemberFn,
} from './functions/searchBlocks'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { requireCampaignMemberRowForCampaign } from '../campaigns/functions/campaignIdentity'
import { resourceIdValidator } from '../resources/validators'
import { requireSidebarItemRow } from '../sidebarItems/functions/sidebarItemIdentity'

const blockShareInfoValidator = v.object({
  noteBlockId: blockNoteIdValidator,
  shareStatus: blockShareStatusValidator,
  memberPermissions: v.record(campaignMemberIdValidator, blockVisibilityPermissionLevelValidator),
})

export const getBlocksWithShares = dmQuery({
  args: {
    noteId: resourceIdValidator,
    blockNoteIds: v.array(blockNoteIdValidator),
  },
  returns: v.object({
    blocks: v.array(blockShareInfoValidator),
    playerMembers: v.array(campaignMemberSummaryValidator),
    notePermissionsByMemberId: v.record(campaignMemberIdValidator, permissionLevelValidator),
  }),
  handler: async (ctx, args) => {
    const note = await requireSidebarItemRow(ctx, args.noteId)
    return await getBlocksWithSharesFn(ctx, {
      noteId: note._id,
      blockNoteIds: args.blockNoteIds.map((id) => assertDomainId(DOMAIN_ID_KIND.noteBlock, id)),
    })
  },
})

const headingResultValidator = v.object({
  noteBlockId: blockNoteIdValidator,
  text: v.string(),
  level: v.number(),
  normalizedText: v.string(),
})

export const getHeadingsByNote = campaignQuery({
  args: {
    noteId: resourceIdValidator,
  },
  returns: v.array(headingResultValidator),
  handler: async (ctx, args) => {
    const note = await requireSidebarItemRow(ctx, args.noteId)
    return await getHeadingsByNoteFn(ctx, { noteId: note._id })
  },
})

const blockSearchResultValidator = v.object({
  blockNoteId: blockNoteIdValidator,
  noteId: resourceIdValidator,
  plainText: v.string(),
  type: blockTypeValidator,
})

export const searchBlocks = campaignQuery({
  args: {
    query: v.string(),
  },
  returns: v.array(blockSearchResultValidator),
  handler: async (ctx, args) => {
    return await searchBlocksFn(ctx, { query: args.query })
  },
})

export const searchBlocksAsMember = dmQuery({
  args: {
    campaignMemberId: campaignMemberIdValidator,
    query: v.string(),
  },
  returns: v.array(blockSearchResultValidator),
  handler: async (ctx, args) => {
    const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, ctx.campaign.campaignUuid)
    const member = await requireCampaignMemberRowForCampaign(ctx, campaignId, args.campaignMemberId)
    return await searchBlocksAsMemberFn(ctx, {
      campaignMemberId: member._id,
      query: args.query,
    })
  },
})
